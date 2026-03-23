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

function Render-Menu {
    param(
        [string[]]$Services,
        [bool[]]$Selected,
        [int]$Cursor
    )

    Clear-Host
    Write-Host '=============================================================='
    Write-Host '              Deasy Docker Service Reload Menu'
    Write-Host '=============================================================='
    Write-Host ''
    Write-Host 'Usa Arriba/Abajo para navegar y espacio para marcar servicios.'
    Write-Host 'Enter: confirmar seleccion | A: seleccionar/deseleccionar todo | Q: salir'
    Write-Host ''

    for ($i = 0; $i -lt $Services.Count; $i++) {
        $pointer = ' '
        $marker = '[ ]'
        if ($Selected[$i]) {
            $marker = '[x]'
        }
        if ($i -eq $Cursor) {
            $pointer = '>'
        }

        Write-Host ("{0} {1} {2}" -f $pointer, $marker, $Services[$i])
    }

    Write-Host ''
}

function Toggle-All {
    param([bool[]]$Selected)

    $allSelected = $true
    for ($i = 0; $i -lt $Selected.Count; $i++) {
        if (-not $Selected[$i]) {
            $allSelected = $false
            break
        }
    }

    $newValue = -not $allSelected
    for ($i = 0; $i -lt $Selected.Count; $i++) {
        $Selected[$i] = $newValue
    }
}

function Get-SelectedServices {
    param(
        [string[]]$Services,
        [bool[]]$Selected
    )

    $result = @()
    for ($i = 0; $i -lt $Services.Count; $i++) {
        if ($Selected[$i]) {
            $result += $Services[$i]
        }
    }

    return $result
}

function Test-ServiceSelected {
    param(
        [string]$Name,
        [string[]]$SelectedServices
    )

    return $SelectedServices -contains $Name
}

function Get-CacheVolumes {
    param([string[]]$SelectedServices)

    $result = @()
    foreach ($service in $SelectedServices) {
        switch ($service) {
            'backend' {
                $result += 'backend_node_modules_v2'
            }
            'storage-uploader' {
                $result += 'backend_node_modules_v2'
            }
            'frontend' {
                $result += 'frontend_node_modules'
                $result += 'frontend_pnpm_store'
            }
            'docs' {
                $result += 'docs_node_modules'
                $result += 'docs_pnpm_store'
            }
        }
    }

    return $result | Select-Object -Unique
}

function Get-PersistentVolumes {
    param([string[]]$SelectedServices)

    $result = @()
    foreach ($service in $SelectedServices) {
        switch ($service) {
            'mariadb' {
                $result += 'mariadb_data'
            }
            'mongodb' {
                $result += 'mongodb_data'
            }
            'rabbitmq' {
                $result += 'rabbitmq_data'
            }
            'emqx' {
                $result += 'emqx_data'
                $result += 'emqx_log'
            }
            'minio' {
                $result += 'minio_data'
            }
            'backend' {
                $result += 'uploads_data'
                $result += 'storage_data'
            }
            'storage-uploader' {
                $result += 'storage_data'
            }
            'signer' {
                $result += 'storage_data'
            }
            'analytics' {
                $result += 'storage_data'
            }
        }
    }

    return $result | Select-Object -Unique
}

function Remove-VolumesBySuffix {
    param([string]$Suffix)

    $allVolumes = @(& docker volume ls --format '{{.Name}}')
    $matches = @($allVolumes | Where-Object { $_ -match "(^|_)$([regex]::Escape($Suffix))$" })

    if (-not $matches -or $matches.Count -eq 0) {
        Write-Host " - (sin coincidencias para $Suffix)"
        return
    }

    foreach ($volume in $matches) {
        & docker volume rm $volume | Out-Null
        Write-Host " - $volume"
    }
}

function Invoke-Reload {
    param([string[]]$SelectedServices)

    $removeCacheVolumes = $false
    $removePersistentVolumes = $false

    Write-Host ''
    Write-Host '--------------------------------------------------------------' -ForegroundColor Yellow
    Write-Host 'ATENCION: Se eliminaran y recrearan los contenedores seleccionados.' -ForegroundColor Yellow
    Write-Host 'Esto puede interrumpir servicios y conexiones en curso.' -ForegroundColor Yellow
    Write-Host '--------------------------------------------------------------' -ForegroundColor Yellow
    Write-Host ''
    Write-Host 'Servicios seleccionados:'
    foreach ($service in $SelectedServices) {
        Write-Host " - $service"
    }
    Write-Host ''

    $confirm = Read-Host 'Escribe RELOAD para continuar'
    if ($confirm -ne 'RELOAD') {
        Write-Host 'Operacion cancelada.'
        exit 0
    }

    $prune = Read-Host 'Eliminar tambien volumenes de cache/dependencias de estos servicios? (y/N)'
    if ($prune -match '^(y|yes)$') {
        $removeCacheVolumes = $true
    }

    $persistentVolumes = @(Get-PersistentVolumes -SelectedServices $SelectedServices)
    if ($persistentVolumes.Count -gt 0) {
        $fullReset = Read-Host 'FULL RESET: eliminar tambien datos persistentes (BD, colas, storage) de estos servicios? (y/N)'
        if ($fullReset -match '^(y|yes)$') {
            $token = Read-Host 'Confirmacion final. Escribe RESET-DATA para borrar datos persistentes'
            if ($token -eq 'RESET-DATA') {
                $removePersistentVolumes = $true
            } else {
                Write-Host 'Token incorrecto. Se omite borrado de datos persistentes.'
            }
        }
    }

    Write-Host ''
    Write-Host 'Deteniendo servicios seleccionados...'
    & docker compose stop @SelectedServices | Out-Null

    Write-Host 'Eliminando contenedores seleccionados...'
    & docker compose rm -f @SelectedServices | Out-Null

    if ($removeCacheVolumes) {
        Write-Host 'Eliminando volumenes de cache/dependencias asociados...'
        $cacheVolumes = Get-CacheVolumes -SelectedServices $SelectedServices
        foreach ($volumeSuffix in $cacheVolumes) {
            Remove-VolumesBySuffix -Suffix $volumeSuffix
        }
    }

    if ($removePersistentVolumes) {
        Write-Host 'Eliminando volumenes persistentes (FULL RESET)...'
        foreach ($volumeSuffix in $persistentVolumes) {
            Remove-VolumesBySuffix -Suffix $volumeSuffix
        }
    }

    if (Test-ServiceSelected -Name 'frontend' -SelectedServices $SelectedServices) {
        Write-Host 'Preparando dependencias de frontend dentro del volumen Docker...'
        & docker compose run --rm --no-deps frontend pnpm install --frozen-lockfile --store-dir /pnpm/store
        if ($LASTEXITCODE -ne 0) {
            throw 'Fallo al preparar dependencias de frontend.'
        }
    }

    if ((Test-ServiceSelected -Name 'backend' -SelectedServices $SelectedServices) -or (Test-ServiceSelected -Name 'storage-uploader' -SelectedServices $SelectedServices)) {
        Write-Host 'Preparando dependencias de backend dentro del volumen Docker...'
        & docker compose run --rm --no-deps --user root backend sh -lc 'npm install && chown -R node:node /app/backend/node_modules'
        if ($LASTEXITCODE -ne 0) {
            throw 'Fallo al preparar dependencias de backend.'
        }
    }

    Write-Host 'Reconstruyendo y levantando solo los servicios seleccionados (sin dependencias)...'
    & docker compose up -d --build --force-recreate --no-deps @SelectedServices
    if ($LASTEXITCODE -ne 0) {
        throw 'Fallo al recrear los servicios seleccionados.'
    }

    Write-Host ''
    Write-Host 'Reload completado.'
    & docker compose ps @SelectedServices
}

Ensure-DockerCli
Ensure-DockerReady
Ensure-ComposeEnv

if (-not (Test-Path (Join-Path $DockerDir 'docker-compose.yml'))) {
    throw "No se encontro docker-compose.yml en $DockerDir"
}

Push-Location $DockerDir
try {
    $services = @(& docker compose config --services)
    if (-not $services -or $services.Count -eq 0) {
        throw 'No se encontraron servicios en docker-compose.yml'
    }

    $selected = New-Object 'bool[]' $services.Count
    $cursor = 0

    while ($true) {
        Render-Menu -Services $services -Selected $selected -Cursor $cursor

        $key = [System.Console]::ReadKey($true)
        switch ($key.Key) {
            'UpArrow' {
                if ($cursor -gt 0) {
                    $cursor--
                }
            }
            'DownArrow' {
                if ($cursor -lt ($services.Count - 1)) {
                    $cursor++
                }
            }
            'Spacebar' {
                $selected[$cursor] = -not $selected[$cursor]
            }
            'A' {
                Toggle-All -Selected $selected
            }
            'Q' {
                Write-Host ''
                Write-Host 'Operacion cancelada.'
                exit 0
            }
            'Enter' {
                $selectedServices = Get-SelectedServices -Services $services -Selected $selected
                if (-not $selectedServices -or $selectedServices.Count -eq 0) {
                    Write-Host ''
                    Write-Host 'Debes seleccionar al menos un servicio.'
                    Start-Sleep -Seconds 1
                    continue
                }

                Invoke-Reload -SelectedServices $selectedServices
                break
            }
        }
    }
} finally {
    Pop-Location
}