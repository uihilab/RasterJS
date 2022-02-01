<?php

require __DIR__ . '/vendor/autoload.php';
use Minishlink\WebPush\WebPush;
use Minishlink\WebPush\Subscription;

// remove warnings
error_reporting(E_ERROR | E_PARSE);

/* Remove the execution time limit */
set_time_limit(0);

$p256dh = $_GET["p256dh"];
$authKey = $_GET["auth"];
$sub_endpoint = $_GET["sub_endpoint"];
$geo_tiles_hash = $_GET["geo_tiles_hash"];
$map_tiles_hash = $_GET["map_tiles_hash"];

$auth = array(
    'VAPID' => array(
        'subject' => 'raster-js',
        // TODO:
        'publicKey' => "<VAPID-PUBLIC-KEY-HERE>",
        // TODO:
        'privateKey' => "<VAPID-PRIVATE-KEY-HERE>"
    ),
);

$webPush = new WebPush($auth);
$subscription = Subscription::create(array("endpoint"=>$sub_endpoint, "keys"=>array("p256dh"=>$p256dh, "auth"=>$authKey)));   

$checker = new DataUpdateChecker($geo_tiles_hash, $map_tiles_hash);
$checker->start();


class DataUpdateChecker {

    public function __construct($georeferenced_images_hash, $map_tiles_hash) {
        $this->old_georeferenced_images_hash = $georeferenced_images_hash;
        $this->old_map_tiles_hash = $map_tiles_hash;
    }

    /**
     * Generate an MD5 hash string from the contents of a directory.
     *
     * @param string $directory
     * @return boolean|string
    */
    public function hashDirectory($directory){
        if (! is_dir($directory))
        {
            return false;
        }
        
        $files = array();
        $dir = dir($directory);
    
        while (false !== ($file = $dir->read()))
        {
            if ($file != '.' and $file != '..')
            {
                if (is_dir($directory . '/' . $file))
                {
                    $files[] = $this->hashDirectory($directory . '/' . $file);
                }
                else
                {
                    $files[] = md5_file($directory . '/' . $file);
                }
            }
        }
    
        $dir->close();
    
        return md5(implode('', $files));
    }

    public function start(){
        global $webPush;
        global $subscription;

        while(1) {
            /* Iteration interval in seconds */
            $curr_georeferenced_images_hash = $this->hashDirectory("../images/");
            $curr_map_tiles_hash = $this->hashDirectory("../map/");
            $updated = false;
                
            if ($curr_georeferenced_images_hash != $this->old_georeferenced_images_hash) {
                $updated = true;
                $this->old_georeferenced_images_hash = $curr_georeferenced_images_hash;
            }
                
            if ($curr_map_tiles_hash != $this->old_map_tiles_hash) {
                $updated = true;
                $this->old_map_tiles_hash = $curr_map_tiles_hash;
            }

            if($updated) {
                $res = $webPush->sendNotification(
                    $subscription,
                    "Data is updated."
                );
                // handle eventual errors here, and remove the subscription from your server if it is expired
                foreach ($webPush->flush() as $report) {
                    $endpoint = $report->getRequest()->getUri()->__toString();
                    if ($report->isSuccess()) {
                        echo "Notification Sent.";
                    } else {
                        echo "Unable to send notification.";
                    }
                }
            }
        }
    }

}

?>
