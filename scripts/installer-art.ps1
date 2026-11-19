# Generates the setup wizard images in installer/art from public/jesse-logo.png,
# with the colors of the app's default "Notte" theme (src/theme.ts).
# Run again after changing the logo or the palette:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/installer-art.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$out = Join-Path $root 'installer\art'
New-Item -ItemType Directory -Force $out | Out-Null
$logo = [System.Drawing.Image]::FromFile((Join-Path $root 'public\jesse-logo.png'))

function Color([string]$hex, [int]$alpha = 255) {
    $c = [System.Drawing.ColorTranslator]::FromHtml($hex)
    [System.Drawing.Color]::FromArgb($alpha, $c.R, $c.G, $c.B)
}
$background = '#0d0e16'; $surface = '#171823'; $accent = '#a97ee0'; $text = '#e9eaf5'; $muted = '#9396ab'

function New-Canvas([int]$w, [int]$h) {
    $bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = 'HighQualityBicubic'
    $g.PixelOffsetMode = 'HighQuality'; $g.CompositingQuality = 'HighQuality'; $g.TextRenderingHint = 'AntiAliasGridFit'
    return $bmp, $g
}
# Soft radial glow blended per pixel (smooth falloff, light dithering against banding).
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
public static class ArtGlow {
    public static void Paint(Bitmap bmp, double cx, double cy, double r, Color c, double strength) {
        var rect = new Rectangle(0, 0, bmp.Width, bmp.Height);
        var data = bmp.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
        var px = new byte[data.Stride * bmp.Height];
        Marshal.Copy(data.Scan0, px, 0, px.Length);
        var rnd = new Random(7);
        for (int y = 0; y < bmp.Height; y++) {
            for (int x = 0; x < bmp.Width; x++) {
                double d = Math.Sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / r;
                if (d >= 1) continue;
                double t = 1 - d; double a = strength * t * t * (3 - 2 * t);
                int i = y * data.Stride + x * 4;
                double n = (rnd.NextDouble() - 0.5) * 1.5;
                px[i] = Clamp(px[i] + (c.B - px[i]) * a + n);
                px[i + 1] = Clamp(px[i + 1] + (c.G - px[i + 1]) * a + n);
                px[i + 2] = Clamp(px[i + 2] + (c.R - px[i + 2]) * a + n);
            }
        }
        Marshal.Copy(px, 0, data.Scan0, px.Length);
        bmp.UnlockBits(data);
    }
    static byte Clamp(double v) { return (byte)Math.Max(0, Math.Min(255, Math.Round(v))); }
}
'@
function Add-Glow($bmp, [double]$cx, [double]$cy, [double]$r, [string]$hex, [double]$strength) {
    [ArtGlow]::Paint($bmp, $cx, $cy, $r, (Color $hex), $strength)
}
function Rounded([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = 2 * $r
    $p.AddArc($x, $y, $d, $d, 180, 90); $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90); $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $p.CloseFigure(); return $p
}
function Draw-Logo($g, [float]$x, [float]$y, [float]$size) {
    $clip = Rounded $x $y $size $size ($size * 0.22)
    $state = $g.Save(); $g.SetClip($clip)
    $g.DrawImage($logo, $x, $y, $size, $size)
    $g.Restore($state)
    $pen = New-Object System.Drawing.Pen (Color $accent 140), ([Math]::Max(1, $size / 64))
    $g.DrawPath($pen, $clip); $pen.Dispose(); $clip.Dispose()
}
function Save($bmp, $g, [string]$name) {
    $bmp.Save((Join-Path $out $name), [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bmp.Dispose()
}

# Page background (aspect 497:360), sizes for 100%, 150% and 250% DPI.
foreach ($size in @(@(596, 432), @(994, 720), @(1630, 1148))) {
    $w = $size[0]; $h = $size[1]
    $bmp, $g = New-Canvas $w $h
    $g.Clear((Color $background))
    $g.Flush()
    Add-Glow $bmp ($w * 0.92) ($h * 0.02) ($w * 0.72) $accent 0.26
    Add-Glow $bmp ($w * 0.04) ($h * 1.0) ($w * 0.58) '#5b6be0' 0.13
    Save $bmp $g "background-$w.png"
}

# Side panel of the welcome and finish pages (aspect 164:314).
foreach ($size in @(@(202, 386), @(336, 643), @(534, 1022))) {
    $w = $size[0]; $h = $size[1]; $s = $w / 202
    $bmp, $g = New-Canvas $w $h
    $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
    $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, (Color $surface), (Color $background), 90
    $g.FillRectangle($grad, $rect); $grad.Dispose()
    $g.Flush()
    Add-Glow $bmp ($w * 0.5) ($h * 0.36) ($w * 0.95) $accent 0.32
    $logoSize = 112 * $s
    Draw-Logo $g (($w - $logoSize) / 2) ($h * 0.36 - $logoSize / 2) $logoSize
    $format = New-Object System.Drawing.StringFormat; $format.Alignment = 'Center'
    $title = New-Object System.Drawing.Font 'Segoe UI Semibold', (17 * $s), ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
    $brand = New-Object System.Drawing.SolidBrush (Color $text)
    $g.DrawString("Jesse's Archive", $title, $brand, (New-Object System.Drawing.RectangleF 0, ($h * 0.36 + $logoSize / 2 + 16 * $s), $w, (30 * $s)), $format)
    $sub = New-Object System.Drawing.Font 'Segoe UI', (11 * $s), ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
    $mutedBrush = New-Object System.Drawing.SolidBrush (Color $muted)
    $g.DrawString('Password manager', $sub, $mutedBrush, (New-Object System.Drawing.RectangleF 0, ($h * 0.36 + $logoSize / 2 + 44 * $s), $w, (20 * $s)), $format)
    $line = New-Object System.Drawing.Pen (Color $accent 120), (2 * $s)
    $g.DrawLine($line, ($w / 2 - 18 * $s), ($h * 0.36 + $logoSize / 2 + 72 * $s), ($w / 2 + 18 * $s), ($h * 0.36 + $logoSize / 2 + 72 * $s))
    $line.Dispose(); $title.Dispose(); $sub.Dispose(); $brand.Dispose(); $mutedBrush.Dispose()
    Save $bmp $g "side-$w.png"
}

# Small logo in the top-right corner of the inner pages (square, transparent).
foreach ($n in 58, 77, 97, 116, 124, 159) {
    $bmp, $g = New-Canvas $n $n
    $g.Clear([System.Drawing.Color]::Transparent)
    $pad = [Math]::Round($n * 0.06)
    Draw-Logo $g $pad $pad ($n - 2 * $pad)
    Save $bmp $g "small-$n.png"
}
$logo.Dispose()
Get-ChildItem $out -Filter *.png | ForEach-Object { '{0,-20} {1,8}' -f $_.Name, $_.Length }
