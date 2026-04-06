$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$DockerDir = Join-Path $RootDir 'docker'
$DockerEnvFile = Join-Path $DockerDir '.env'
$DockerEnvExampleFile = Join-Path $DockerDir '.env.example'
$BackendDir = Join-Path $RootDir 'backend'
$DefaultSeedFile = Join-Path $RootDir 'backend/scripts/seeds/pucese.seed.json'

$RunDbSeed = $true
$RunStorageSeeds = $true
$SeedFile = $DefaultSeedFile

function Show-Usage {
    Write-Host 'Uso:'
    Write-Host '  scripts/run-seeds.ps1 [-SkipDb] [-SkipStorage] [-SeedFile <ruta>]'
    Write-Host ''
    Write-Host 'Opciones:'
    Write-Host '  -SkipDb        Omite la semilla SQL de MariaDB.'
    Write-Host '  -SkipStorage   Omite la publicacion de seeds en MinIO.'
    Write-Host '  -SeedFile      Ruta alternativa al archivo JSON de la semilla SQL.'
}

function Test-ServiceRunning($ServiceName) {
    Push-Location $DockerDir
    try {
        $services = docker compose ps --status running --services
        return ($services -contains $ServiceName)
    } finally {
        Pop-Location
    }
}

function Ensure-ServiceRunning($ServiceName) {
    if (Test-ServiceRunning $ServiceName) {
        return
    }
    throw "El servicio '$ServiceName' no esta en ejecucion. Inicialo antes de correr run-seeds."
}

function Ensure-Command($Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Falta el comando requerido: $Name"
    }
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

function Read-ComposeEnv {
    $result = @{}
    foreach ($line in Get-Content $DockerEnvFile) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith('#')) {
            continue
        }

        $parts = $trimmed -split '=', 2
        if ($parts.Count -ne 2) {
            continue
        }

        $result[$parts[0]] = $parts[1]
    }
    return $result
}

function Ensure-BackendDependencies {
    Ensure-Command 'node'
    Ensure-Command 'npm'

    $mysqlPackage = Join-Path $BackendDir 'node_modules/mysql2/package.json'
    if (Test-Path $mysqlPackage) {
        return
    }

    Write-Host 'Instalando dependencias del backend con npm install sin modificar package-lock.json...'
    npm install --prefix $BackendDir --no-audit --no-fund --no-package-lock
}

function Wait-ForMariaDb($ComposeEnv) {
    Write-Host 'Esperando que MariaDB este lista...'
    Start-Sleep -Seconds 15
    Push-Location $DockerDir
    try {
        for ($attempt = 0; $attempt -lt 60; $attempt++) {
            $env:MYSQL_PWD = $ComposeEnv['MARIADB_ROOT_PASSWORD']
            try {
                docker compose exec -T mariadb mariadb-admin ping -h 127.0.0.1 -uroot --silent *> $null
                Write-Host '✅ MariaDB lista.'
                return
            } catch {
                Start-Sleep -Seconds 2
            } finally {
                Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
            }
        }
    } finally {
        Pop-Location
    }

    throw 'MariaDB no estuvo lista a tiempo para aplicar la semilla.'
}

function Resolve-MariaDbHostPort($ComposeEnv) {
    Push-Location $DockerDir
    try {
        $line = docker compose port mariadb 3306 2>$null | Select-Object -Last 1
    } finally {
        Pop-Location
    }

    if ($line) {
        $parts = $line.Trim().Split(':')
        if ($parts.Count -gt 0) {
            return $parts[$parts.Count - 1]
        }
    }

    if ($ComposeEnv.ContainsKey('MARIADB_PORT') -and $ComposeEnv['MARIADB_PORT']) {
        return $ComposeEnv['MARIADB_PORT']
    }

    # Fallback al puerto publicado actual en docker-compose.yml.
    return '3308'
}

function Run-DbSeed($ComposeEnv) {
    $mariadbPort = Resolve-MariaDbHostPort $ComposeEnv

    Write-Host "Aplicando semilla SQL desde $SeedFile..."
    $previous = @{}
    $seedEnv = @{
        MARIADB_HOST     = '127.0.0.1'
        MARIADB_PORT     = '3308'
        MARIADB_USER     = $ComposeEnv['MARIADB_USER']
        MARIADB_PASSWORD = $ComposeEnv['MARIADB_PASSWORD']
        MARIADB_DATABASE = $ComposeEnv['MARIADB_DATABASE']
    }

    foreach ($entry in $seedEnv.GetEnumerator()) {
        $previous[$entry.Key] = [Environment]::GetEnvironmentVariable($entry.Key)
        [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value)
    }

    try {
        node (Join-Path $RootDir 'backend/scripts/seed_pucese.mjs') apply --file $SeedFile
    } finally {
        foreach ($entry in $seedEnv.GetEnumerator()) {
            [Environment]::SetEnvironmentVariable($entry.Key, $previous[$entry.Key])
        }
    }
}

function Run-StorageSeeds {
    Write-Host 'Publicando seeds de plantillas en MinIO...'
    $shFile = Join-Path $DockerDir 'minio\publish-template-seeds.sh'
    $content = [System.IO.File]::ReadAllText($shFile)
    if ($content.Contains("`r`n")) {
        [System.IO.File]::WriteAllText($shFile, $content.Replace("`r`n", "`n"), [System.Text.Encoding]::UTF8)
        Write-Host '✅ Saltos de linea corregidos en publish-template-seeds.sh'
    }
    Push-Location $DockerDir
    try {
        docker compose --profile storage-publish-seeds run --rm --no-deps minio-publish-seeds
    } finally {
        Pop-Location
    }
}

for ($index = 0; $index -lt $args.Count; $index++) {
    switch ($args[$index]) {
        '-SkipDb' {
            $RunDbSeed = $false
        }
        '-SkipStorage' {
            $RunStorageSeeds = $false
        }
        '-SeedFile' {
            if ($index + 1 -ge $args.Count) {
                throw 'Falta el valor para -SeedFile'
            }
            $index++
            $candidate = $args[$index]
            if ([System.IO.Path]::IsPathRooted($candidate)) {
                $SeedFile = $candidate
            } else {
                $SeedFile = Join-Path $RootDir $candidate
            }
        }
        '-h' {
            Show-Usage
            exit 0
        }
        '--help' {
            Show-Usage
            exit 0
        }
        default {
            throw "Opcion no soportada: $($args[$index])"
        }
    }
}

if (-not $RunDbSeed -and -not $RunStorageSeeds) {
    throw 'No hay acciones para ejecutar. Usa al menos una semilla habilitada.'
}

if (-not (Test-Path $SeedFile)) {
    throw "No existe el archivo de seed SQL: $SeedFile"
}

Ensure-Command 'docker'
Ensure-ComposeEnv
$composeEnv = Read-ComposeEnv

if ($RunDbSeed) {
    Ensure-ServiceRunning 'mariadb'
    Ensure-BackendDependencies
    Wait-ForMariaDb $composeEnv
    Run-DbSeed $composeEnv
}

if ($RunStorageSeeds) {
    Ensure-ServiceRunning 'minio'
    Run-StorageSeeds
}

Write-Host 'Seeds completados correctamente.'
