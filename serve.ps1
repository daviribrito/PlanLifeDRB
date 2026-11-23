<#
  PlanLife - servidor local (sem instalação).
  Serve os arquivos estáticos e expõe uma API mínima para gravar os JSON em /data.
  Uso:  pwsh -File serve.ps1            (ou dê dois cliques em start.cmd)
        pwsh -File serve.ps1 -Port 3200
#>
param([int]$Port = 3100)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$DataRoot = Join-Path $Root 'data'
$Prefix = "http://localhost:$Port/"
$Utf8 = New-Object System.Text.UTF8Encoding($false)

$Mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json; charset=utf-8'; '.svg' = 'image/svg+xml'
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.ico' = 'image/x-icon'; '.webmanifest' = 'application/manifest+json'
  '.md' = 'text/markdown; charset=utf-8'; '.txt' = 'text/plain; charset=utf-8'; '.woff2' = 'font/woff2'
}

function Send([System.Net.HttpListenerResponse]$res, [int]$code, [string]$body, [string]$type = 'application/json; charset=utf-8') {
  $bytes = $Utf8.GetBytes($body)
  $res.StatusCode = $code
  $res.ContentType = $type
  $res.Headers['Cache-Control'] = 'no-store'
  $res.ContentLength64 = $bytes.Length
  if ($script:CurrentMethod -ne 'HEAD') { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
  $res.Close()
}

function Write-DataFile([string]$rel, [string]$json) {
  if ($rel -notmatch '^[a-z0-9][a-z0-9_.\-]*(/[a-z0-9][a-z0-9_.\-]*)*\.json$' -or $rel.Contains('..')) { throw "Caminho inválido: $rel" }
  $null = $json | ConvertFrom-Json   # valida JSON
  $target = [System.IO.Path]::GetFullPath((Join-Path $DataRoot $rel))
  if (-not $target.StartsWith([System.IO.Path]::GetFullPath($DataRoot))) { throw 'Fora da pasta data' }
  $dir = Split-Path -Parent $target
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $tmp = "$target.tmp"
  [System.IO.File]::WriteAllText($tmp, $json, $Utf8)
  Move-Item -LiteralPath $tmp -Destination $target -Force
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($Prefix)
try { $listener.Start() } catch { Write-Host "Não foi possível abrir a porta $Port. Ela já está em uso?" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "  PlanLife rodando em $Prefix" -ForegroundColor Cyan
Write-Host "  Dados gravados em $DataRoot"
Write-Host "  Ctrl+C para parar."
Write-Host ""

try {
  while ($listener.IsListening) {
    $task = $listener.GetContextAsync()
    while (-not $task.AsyncWaitHandle.WaitOne(250)) { }
    $ctx = $task.GetAwaiter().GetResult()
    $req = $ctx.Request; $res = $ctx.Response
    $script:CurrentMethod = $req.HttpMethod
    $path = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)
    try {
      if ($path -eq '/api/health') {
        Send $res 200 '{"ok":true,"mode":"local"}'; continue
      }
      if ($path.StartsWith('/api/data/')) {
        $origin = $req.Headers['Origin']
        if ($origin -and $origin -ne $Prefix.TrimEnd('/')) { Send $res 403 '{"error":"origem não permitida"}'; continue }
        if ($req.HttpMethod -ne 'PUT') { Send $res 405 '{"error":"use PUT"}'; continue }
        $reader = New-Object System.IO.StreamReader($req.InputStream, $Utf8)
        $body = $reader.ReadToEnd(); $reader.Close()
        Write-DataFile $path.Substring('/api/data/'.Length) $body
        Write-Host ("  salvo  data/" + $path.Substring('/api/data/'.Length)) -ForegroundColor DarkGray
        Send $res 200 '{"ok":true}'; continue
      }
      if ($req.HttpMethod -ne 'GET' -and $req.HttpMethod -ne 'HEAD') { Send $res 405 '{"error":"método não suportado"}'; continue }
      if ($path -eq '/') { $path = '/index.html' }
      $file = [System.IO.Path]::GetFullPath((Join-Path $Root $path.TrimStart('/')))
      if (-not $file.StartsWith($Root) -or -not (Test-Path -LiteralPath $file -PathType Leaf)) {
        Send $res 404 '{"error":"não encontrado"}'; continue
      }
      $ext = [System.IO.Path]::GetExtension($file).ToLower()
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $res.StatusCode = 200
      $res.ContentType = $(if ($Mime[$ext]) { $Mime[$ext] } else { 'application/octet-stream' })
      $res.Headers['Cache-Control'] = 'no-cache'
      $res.ContentLength64 = $bytes.Length
      if ($req.HttpMethod -eq 'GET') { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
      $res.Close()
    } catch {
      Write-Host "  erro: $($_.Exception.Message)" -ForegroundColor Yellow
      try { Send $res 400 (@{ error = $_.Exception.Message } | ConvertTo-Json -Compress) } catch { }
    }
  }
} finally {
  $listener.Stop(); $listener.Close()
}
