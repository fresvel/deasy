$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$DockerDir = Join-Path $RootDir 'docker'
$DockerEnvFile = Join-Path $DockerDir '.env'
$DockerEnvExampleFile = Join-Path $DockerDir '.env.example'

function Ensure-DockerCli {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Docker no esta instalado o no esta en PATH.'
    }
}

function Ensure-DockerReady {
    try {
        docker info | Out-Null
        return
    } catch {
        Start-Process 'Docker Desktop' -ErrorAction SilentlyContinue | Out-Null
    }

    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Seconds 2
        try {
            docker info | Out-Null
            return
        } catch {
        }
    }

    throw 'Docker no esta disponible. Inicia Docker Desktop o el daemon de Docker y vuelve a intentar.'
}

function Ensure-ComposeEnv {
    if (Test-Path $DockerEnvFile) {
        return
    }

    if (Test-Path $DockerEnvExampleFile) {
        Copy-Item $DockerEnvExampleFile $DockerEnvFile
        Write-Host "Se creo $DockerEnvFile a partir de .env.example"
        return
    }

    throw "Falta $DockerEnvFile y no existe una plantilla .env.example"
}

Ensure-DockerCli
Ensure-DockerReady
Ensure-ComposeEnv

if (-not (Test-Path (Join-Path $DockerDir 'docker-compose.yml'))) {
    throw "No se encontro docker-compose.yml en $DockerDir"
}

Push-Location $DockerDir
try {
    docker compose up -d
    docker compose --profile workers up -d
} finally {
    Pop-Location
}

Write-Host "Servicios iniciados. Usa 'docker compose ps' para verificar estado."