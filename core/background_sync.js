import indexeddb from "./indexeddb.js";
import Constant from "./constant.js";

/**
 * Syncs raster images with indexeddb.
 * 1. It gets current status of sync.
 * 2. If sync was never started then
 *    it loads first image of 50 m res for building elevation.
 * 3. If sync was started then it gets status of the last sync.
 * 4. It gets total number of images that were synced,
 *    id of last synced image, resolution and elevation of last synced image.
 * 5. It starts syncing data from the last state of sync.
 * 6. First it syncs buildings elevation images then
 *    it syncs bare earth elevation images.
 * 7. For each of these elevations order in terms of
 *    resolution is 50 m, 25 m, 10 m, 5 m, 1m.
 */

export default function sync() {
  let total_images =
    Constant.FIFTY_METER_IMAGES.length +
    Constant.TWENTY_FIVE_METER_IMAGES.length +
    Constant.TEN_METER_IMAGES.length +
    Constant.FIVE_METER_IMAGES.length +
    Constant.ONE_METER_IMAGES.length;

  indexeddb
    .getSyncStatus()
    .then((status) => {
      /**
       * if syncing was never started
       * then store first image of 50 m res for buildings elevation.
       */
      if (Object.keys(status).length === 0) {
        let total_images_synced = 0;
        let imageId = Constant.FIFTY_METER_IMAGES[0];
        let index = {
          [Constant.INDEX_ROW]: imageId.split("/")[0],
          [Constant.INDEX_COL]: imageId.split("/")[1],
        };
        // saves image in indexeddb if not already saved.
        indexeddb
          .getImage(index, Constant.FIFTY_METER, Constant.ELEVATION_BUILDINGS)
          .then((imageProps) => {
            total_images_synced += 1;
            indexeddb
              .updateSyncStatus(
                total_images_synced,
                imageId,
                Constant.FIFTY_METER,
                Constant.ELEVATION_BUILDINGS
              )
              .then((resolved) => {
                if (resolved) sync();
              });
          });
      } else {
        let total_images_synced = status["TOTAL_IMAGES_SYNCED"];
        let last_image_synced = status["LAST_IMAGE_SYNCED"];
        let last_image_synced_ele = status["LAST_IMAGE_SYNCED_ELE"];
        let last_image_synced_res = status["LAST_IMAGE_SYNCED_RES"];

        // if first elevation i.e buildings images still needs to be synced
        if (
          last_image_synced_ele == Constant.ELEVATION_BUILDINGS &&
          total_images_synced < total_images
        ) {
          /**
           * total_images_synced length after
           * syncing of all fifty meter images
           */
          let fifty_meter_thres = Constant.FIFTY_METER_IMAGES.length;

          /**
           * total_images_synced length after
           * syncing of all fifty meter and 25 m images
           */
          let twenty_five_meter_thres =
            fifty_meter_thres + Constant.TWENTY_FIVE_METER_IMAGES.length;

          /**
           * total_images_synced length after
           * syncing of all 50 m, 25 m and 10 m images
           */
          let ten_meter_thres =
            twenty_five_meter_thres + Constant.TEN_METER_IMAGES.length;

          /**
           * total_images_synced length after
           * syncing of all 50 m, 25 m, 10 m and 5 m images
           */

          let five_meter_thres =
            ten_meter_thres + Constant.FIVE_METER_IMAGES.length;

          /**
           * total_images_synced length after
           * syncing of all 50 m, 25 m, 10 m, 5 m and 1 m images
           */
          let one_meter_thres =
            five_meter_thres + Constant.ONE_METER_IMAGES.length;

          if (
            last_image_synced_res == Constant.FIFTY_METER &&
            total_images_synced < fifty_meter_thres
          ) {
            let nextImageIndex =
              Constant.FIFTY_METER_IMAGES.indexOf(last_image_synced) + 1;
            let imageId = Constant.FIFTY_METER_IMAGES[nextImageIndex];
            let index = {
              [Constant.INDEX_ROW]: imageId.split("/")[0],
              [Constant.INDEX_COL]: imageId.split("/")[1],
            };
            // saves image in indexeddb if not already saved.
            indexeddb
              .getImage(
                index,
                Constant.FIFTY_METER,
                Constant.ELEVATION_BUILDINGS
              )
              .then((imageProps) => {
                total_images_synced += 1;
                indexeddb
                  .updateSyncStatus(
                    total_images_synced,
                    imageId,
                    Constant.FIFTY_METER,
                    Constant.ELEVATION_BUILDINGS
                  )
                  .then((resolved) => {
                    if (resolved) sync();
                  });
              });
          } else if (
            total_images_synced == fifty_meter_thres ||
            (last_image_synced_res == Constant.TWENTY_FIVE_METER &&
              total_images_synced < twenty_five_meter_thres)
          ) {
            let nextImageIndex;
            // if first image of 25 m res
            if (total_images_synced == fifty_meter_thres) {
              nextImageIndex = 0;
            } else {
              nextImageIndex =
                Constant.TWENTY_FIVE_METER_IMAGES.indexOf(last_image_synced) +
                1;
            }

            let imageId = Constant.TWENTY_FIVE_METER_IMAGES[nextImageIndex];
            let index = {
              [Constant.INDEX_ROW]: imageId.split("/")[0],
              [Constant.INDEX_COL]: imageId.split("/")[1],
            };

            // saves image in indexeddb if not already saved.
            indexeddb
              .getImage(
                index,
                Constant.TWENTY_FIVE_METER,
                Constant.ELEVATION_BUILDINGS
              )
              .then((imageProps) => {
                total_images_synced += 1;
                indexeddb
                  .updateSyncStatus(
                    total_images_synced,
                    imageId,
                    Constant.TWENTY_FIVE_METER,
                    Constant.ELEVATION_BUILDINGS
                  )
                  .then((resolved) => {
                    if (resolved) sync();
                  });
              });
          } else if (
            total_images_synced == twenty_five_meter_thres ||
            (last_image_synced_res == Constant.TEN_METER &&
              total_images_synced < ten_meter_thres)
          ) {
            let nextImageIndex;
            // if first image of 10 m res
            if (total_images_synced == twenty_five_meter_thres) {
              nextImageIndex = 0;
            } else {
              nextImageIndex =
                Constant.TEN_METER_IMAGES.indexOf(last_image_synced) + 1;
            }

            let imageId = Constant.TEN_METER_IMAGES[nextImageIndex];
            let index = {
              [Constant.INDEX_ROW]: imageId.split("/")[0],
              [Constant.INDEX_COL]: imageId.split("/")[1],
            };
            // saves image in indexeddb if not already saved.
            indexeddb
              .getImage(index, Constant.TEN_METER, Constant.ELEVATION_BUILDINGS)
              .then((imageProps) => {
                total_images_synced += 1;
                indexeddb
                  .updateSyncStatus(
                    total_images_synced,
                    imageId,
                    Constant.TEN_METER,
                    Constant.ELEVATION_BUILDINGS
                  )
                  .then((resolved) => {
                    if (resolved) sync();
                  });
              });
          } else if (
            total_images_synced == ten_meter_thres ||
            (last_image_synced_res == Constant.FIVE_METER &&
              total_images_synced < five_meter_thres)
          ) {
            let nextImageIndex;
            // if first image of 5 m res
            if (total_images_synced == ten_meter_thres) {
              nextImageIndex = 0;
            } else {
              nextImageIndex =
                Constant.FIVE_METER_IMAGES.indexOf(last_image_synced) + 1;
            }

            let imageId = Constant.FIVE_METER_IMAGES[nextImageIndex];
            let index = {
              [Constant.INDEX_ROW]: imageId.split("/")[0],
              [Constant.INDEX_COL]: imageId.split("/")[1],
            };
            // saves image in indexeddb if not already saved.
            indexeddb
              .getImage(
                index,
                Constant.FIVE_METER,
                Constant.ELEVATION_BUILDINGS
              )
              .then((imageProps) => {
                total_images_synced += 1;
                indexeddb
                  .updateSyncStatus(
                    total_images_synced,
                    imageId,
                    Constant.FIVE_METER,
                    Constant.ELEVATION_BUILDINGS
                  )
                  .then((resolved) => {
                    if (resolved) sync();
                  });
              });
          } else if (
            total_images_synced == five_meter_thres ||
            (last_image_synced_res == Constant.ONE_METER &&
              total_images_synced < one_meter_thres)
          ) {
            let nextImageIndex;
            // if first image of 1 m res
            if (total_images_synced == five_meter_thres) {
              nextImageIndex = 0;
            } else {
              nextImageIndex =
                Constant.ONE_METER_IMAGES.indexOf(last_image_synced) + 1;
            }

            let imageId = Constant.ONE_METER_IMAGES[nextImageIndex];
            let index = {
              [Constant.INDEX_ROW]: imageId.split("/")[0],
              [Constant.INDEX_COL]: imageId.split("/")[1],
            };
            // saves image in indexeddb if not already saved.
            indexeddb
              .getImage(index, Constant.ONE_METER, Constant.ELEVATION_BUILDINGS)
              .then((imageProps) => {
                total_images_synced += 1;
                indexeddb
                  .updateSyncStatus(
                    total_images_synced,
                    imageId,
                    Constant.ONE_METER,
                    Constant.ELEVATION_BUILDINGS
                  )
                  .then((resolved) => {
                    if (resolved) sync();
                  });
              });
          }
        }
        // if second elevation i.e bare earth images still needs to be synced
        else if (
          total_images_synced == total_images ||
          (last_image_synced_ele == Constant.ELEVATION_BARE_EARTH &&
            total_images_synced < total_images_synced * 2)
        ) {
          /**
           * total_images_synced length after
           * syncing of all 50 m images for bare earth elevation
           */
          let fifty_meter_thres =
            total_images + Constant.FIFTY_METER_IMAGES.length;
          /**
           * total_images_synced length after
           * syncing of all fifty meter and 25 m images for bare earth elevation
           */
          let twenty_five_meter_thres =
            fifty_meter_thres + Constant.TWENTY_FIVE_METER_IMAGES.length;
          /**
           * total_images_synced length after
           * syncing of all 50 m, 25 m and 10 m images for bare earth elevation
           */
          let ten_meter_thres =
            twenty_five_meter_thres + Constant.TEN_METER_IMAGES.length;
          /**
           * total_images_synced length after
           * syncing of all 50 m, 25 m, 10 m and 5 m images for bare earth elevation
           */
          let five_meter_thres =
            ten_meter_thres + Constant.FIVE_METER_IMAGES.length;
          /**
           * total_images_synced length after
           * syncing of all 50 m, 25 m, 10 m, 5 m and 1 m images for bare earth elevation
           */
          let one_meter_thres =
            five_meter_thres + Constant.ONE_METER_IMAGES.length;

          if (
            total_images_synced == total_images ||
            (last_image_synced_res == Constant.FIFTY_METER &&
              total_images_synced < fifty_meter_thres)
          ) {
            let nextImageIndex;
            // if first image of 50 m res for bare earth elevation
            if (total_images_synced == total_images) {
              nextImageIndex = 0;
            } else {
              nextImageIndex =
                Constant.FIFTY_METER_IMAGES.indexOf(last_image_synced) + 1;
            }

            let imageId = Constant.FIFTY_METER_IMAGES[nextImageIndex];
            let index = {
              [Constant.INDEX_ROW]: imageId.split("/")[0],
              [Constant.INDEX_COL]: imageId.split("/")[1],
            };
            // saves image in indexeddb if not already saved.
            indexeddb
              .getImage(
                index,
                Constant.FIFTY_METER,
                Constant.ELEVATION_BARE_EARTH
              )
              .then((imageProps) => {
                total_images_synced += 1;
                indexeddb
                  .updateSyncStatus(
                    total_images_synced,
                    imageId,
                    Constant.FIFTY_METER,
                    Constant.ELEVATION_BARE_EARTH
                  )
                  .then((resolved) => {
                    if (resolved) sync();
                  });
              });
          } else if (
            total_images_synced == fifty_meter_thres ||
            (last_image_synced_res == Constant.TWENTY_FIVE_METER &&
              total_images_synced < twenty_five_meter_thres)
          ) {
            let nextImageIndex;
            // if first image of 25 m res for bare earth elevation
            if (total_images_synced == fifty_meter_thres) {
              nextImageIndex = 0;
            } else {
              nextImageIndex =
                Constant.TWENTY_FIVE_METER_IMAGES.indexOf(last_image_synced) +
                1;
            }

            let imageId = Constant.TWENTY_FIVE_METER_IMAGES[nextImageIndex];
            let index = {
              [Constant.INDEX_ROW]: imageId.split("/")[0],
              [Constant.INDEX_COL]: imageId.split("/")[1],
            };

            // saves image in indexeddb if not already saved.
            indexeddb
              .getImage(
                index,
                Constant.TWENTY_FIVE_METER,
                Constant.ELEVATION_BARE_EARTH
              )
              .then((imageProps) => {
                total_images_synced += 1;
                indexeddb
                  .updateSyncStatus(
                    total_images_synced,
                    imageId,
                    Constant.TWENTY_FIVE_METER,
                    Constant.ELEVATION_BARE_EARTH
                  )
                  .then((resolved) => {
                    if (resolved) sync();
                  });
              });
          } else if (
            total_images_synced == twenty_five_meter_thres ||
            (last_image_synced_res == Constant.TEN_METER &&
              total_images_synced < ten_meter_thres)
          ) {
            let nextImageIndex;
            // if first image of 10 m res for bare earth elevation
            if (total_images_synced == twenty_five_meter_thres) {
              nextImageIndex = 0;
            } else {
              nextImageIndex =
                Constant.TEN_METER_IMAGES.indexOf(last_image_synced) + 1;
            }

            let imageId = Constant.TEN_METER_IMAGES[nextImageIndex];
            let index = {
              [Constant.INDEX_ROW]: imageId.split("/")[0],
              [Constant.INDEX_COL]: imageId.split("/")[1],
            };
            // saves image in indexeddb if not already saved.
            indexeddb
              .getImage(
                index,
                Constant.TEN_METER,
                Constant.ELEVATION_BARE_EARTH
              )
              .then((imageProps) => {
                total_images_synced += 1;
                indexeddb
                  .updateSyncStatus(
                    total_images_synced,
                    imageId,
                    Constant.TEN_METER,
                    Constant.ELEVATION_BARE_EARTH
                  )
                  .then((resolved) => {
                    if (resolved) sync();
                  });
              });
          } else if (
            total_images_synced == ten_meter_thres ||
            (last_image_synced_res == Constant.FIVE_METER &&
              total_images_synced < five_meter_thres)
          ) {
            let nextImageIndex;
            // if first image of 5 m res for bare earth elevation
            if (total_images_synced == ten_meter_thres) {
              nextImageIndex = 0;
            } else {
              nextImageIndex =
                Constant.FIVE_METER_IMAGES.indexOf(last_image_synced) + 1;
            }

            let imageId = Constant.FIVE_METER_IMAGES[nextImageIndex];
            let index = {
              [Constant.INDEX_ROW]: imageId.split("/")[0],
              [Constant.INDEX_COL]: imageId.split("/")[1],
            };
            // saves image in indexeddb if not already saved.
            indexeddb
              .getImage(
                index,
                Constant.FIVE_METER,
                Constant.ELEVATION_BARE_EARTH
              )
              .then((imageProps) => {
                total_images_synced += 1;
                indexeddb
                  .updateSyncStatus(
                    total_images_synced,
                    imageId,
                    Constant.FIVE_METER,
                    Constant.ELEVATION_BARE_EARTH
                  )
                  .then((resolved) => {
                    if (resolved) sync();
                  });
              });
          } else if (
            total_images_synced == five_meter_thres ||
            (last_image_synced_res == Constant.ONE_METER &&
              total_images_synced < one_meter_thres)
          ) {
            let nextImageIndex;
            // if first image of 1 m res
            if (total_images_synced == five_meter_thres) {
              nextImageIndex = 0;
            } else {
              nextImageIndex =
                Constant.ONE_METER_IMAGES.indexOf(last_image_synced) + 1;
            }

            let imageId = Constant.ONE_METER_IMAGES[nextImageIndex];
            let index = {
              [Constant.INDEX_ROW]: imageId.split("/")[0],
              [Constant.INDEX_COL]: imageId.split("/")[1],
            };
            // saves image in indexeddb if not already saved.
            indexeddb
              .getImage(
                index,
                Constant.ONE_METER,
                Constant.ELEVATION_BARE_EARTH
              )
              .then((imageProps) => {
                total_images_synced += 1;
                indexeddb
                  .updateSyncStatus(
                    total_images_synced,
                    imageId,
                    Constant.ONE_METER,
                    Constant.ELEVATION_BARE_EARTH
                  )
                  .then((resolved) => {
                    if (resolved) sync();
                  });
              });
          }
        }
      }
    })
    .catch((error) => {
      console.log(error);
    });
}
