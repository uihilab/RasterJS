<?php
$filename = $_GET['url'];
$ext = pathinfo($filename, PATHINFO_EXTENSION);
switch ($ext) {
    case "gif":
        header('Content-Type: image/gif');
        readfile($filename);
        break;
    case "png":
        header('Content-Type: image/png');
        readfile($filename);
        break;
    case "jpg":
    default:
        header('Content-Type: image/jpeg');
        readfile($filename);
        break;
}
?>