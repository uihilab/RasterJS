import ImageProps from "./imageprops.js";
import Constant from "./constant.js";
import Api from "./api.js";

class IndexedDb {
  constructor() {
    this._dbName = "MapUI";
    this._storeNames = [
      Constant.OBJECT_STORE_MAP[Constant.ONE_METER],
      Constant.OBJECT_STORE_MAP[Constant.FIVE_METER],
      Constant.OBJECT_STORE_MAP[Constant.TEN_METER],
      Constant.OBJECT_STORE_MAP[Constant.TWENTY_FIVE_METER],
      Constant.OBJECT_STORE_MAP[Constant.FIFTY_METER],
      Constant.OBJECT_STORE_MAP[Constant.COLLECTIONS],
      Constant.OBJECT_STORE_MAP[Constant.SYNC_METER],
    ];
    this._dbConn = null;
    this._version = 2;
    // store names of resolutions
    this._resStoreNameMap = new Map();
    this._resStoreNameMap.set(this._storeNames[0], Constant.ONE_METER);
    this._resStoreNameMap.set(this._storeNames[1], Constant.FIVE_METER);
    this._resStoreNameMap.set(this._storeNames[2], Constant.TEN_METER);
    this._resStoreNameMap.set(this._storeNames[3], Constant.TWENTY_FIVE_METER);
    this._resStoreNameMap.set(this._storeNames[4], Constant.FIFTY_METER);
    this._loadingInProgress = false;
  }

  //****Warning****
  //function to delete entire database
  deleteDb() {
    window.indexedDB.deleteDatabase(this._dbName);
  }

  _checkIndexedDbSupport() {
    window.indexedDB =
      window.indexedDB ||
      window.mozIndexedDB ||
      window.webkitIndexedDB ||
      window.msIndexedDB;
    window.IDBTransaction =
      window.IDBTransaction ||
      window.webkitIDBTransaction ||
      window.msIDBTransaction;
    window.IDBKeyRange =
      window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;
    if (!window.indexedDB) {
      window.alert("Browser doesn't support a stable version of IndexedDB.");
      return false;
    }
    return true;
  }

  /**
   * Creates Database schema if not created and returns 
   * connection to database by enclosing it inside promise
   * @returns {Promise} Promise that will return connection to database
   */
  _getDbConnection() {
    return new Promise(function (resolve, reject) {
      let request = window.indexedDB.open(
        indexeddb._dbName,
        indexeddb._version
      );
      request.onerror = function () {
        console.log("Can not open/create " + indexeddb._dbName);
      };
      request.onupgradeneeded = function (event) {
        indexeddb._dbConn = request.result;
        indexeddb._storeNames.forEach(function (storeName, index) {
          if (!indexeddb._dbConn.objectStoreNames.contains(storeName)) {
            if (storeName == Constant.OBJECT_STORE_MAP[Constant.COLLECTIONS]) {
              let store = indexeddb._dbConn.createObjectStore(storeName, {
                keyPath: ["ELEVATION", "RESOLUTION"],
                unique: true,
              });
              store.createIndex("ELEVATION", "ELEVATION", { unique: false });
              store.createIndex("SCALE", "SCALE", { unique: false });
              store.createIndex("NO_OF_IMAGES", "TOTAL_IMAGES", {
                unique: false,
              });
            } else if (
              storeName == Constant.OBJECT_STORE_MAP[Constant.SYNC_METER]
            ) {
              let store = indexeddb._dbConn.createObjectStore(storeName, {
                keyPath: ["KEY"],
                unique: true,
              });
              store.createIndex("KEY", "KEY", { unique: false });
              store.createIndex("TOTAL_IMAGES_SYNCED", "TOTAL_IMAGES_SYNCED", {
                unique: false,
              });
              store.createIndex("LAST_IMAGE_SYNCED", "LAST_IMAGE_SYNCED", {
                unique: false,
              });
              store.createIndex(
                "LAST_IMAGE_SYNCED_ELE",
                "LAST_IMAGE_SYNCED_ELE",
                { unique: false }
              );
              store.createIndex(
                "LAST_IMAGE_SYNCED_RES",
                "LAST_IMAGE_SYNCED_RES",
                {
                  unique: false,
                }
              );
            } else {
              let store = indexeddb._dbConn.createObjectStore(storeName, {
                keyPath: ["INDEX_ROW", "INDEX_COL", "ELEVATION"],
                unique: true,
              });
              store.createIndex("BLOB", "BLOB", { unique: false });
            }
          }
        });
      };
      request.onsuccess = function (event) {
        indexeddb._dbConn = request.result;
        indexeddb._dbConn.onerror = function (event) {
          console.log("Error: " + event.target.errorCode);
          reject("Error: " + event.target.errorCode);
        };
        resolve(indexeddb._dbConn);
      };
    });
  }

  //**dataURL to blob**
  _dataURLtoBlob(dataurl) {
    var arr = dataurl.split(","),
      mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]),
      n = bstr.length,
      u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  }

  //**blob to dataURL**
  _blobToDataURL(blob, callback) {
    var a = new FileReader();
    a.onload = function (e) {
      callback(e.target.result);
    };
    a.readAsDataURL(blob);
  }

  saveImage(resolution, indexRow, indexCol, elevation, dataUrl) {
    return new Promise(function (resolve, reject) {
      indexeddb._getDbConnection().then((dbConn) => {
        let storeName = indexeddb._getObjectStoreName(resolution);
        let transaction = dbConn.transaction(storeName, "readwrite");
        let store = transaction.objectStore(storeName);
        let addRequest = store.put({
          INDEX_ROW: indexRow,
          INDEX_COL: indexCol,
          ELEVATION: elevation,
          BLOB: indexeddb._dataURLtoBlob(dataUrl),
        });

        transaction.oncomplete = function (event) {
          dbConn.close();
          resolve(true);
        };
        addRequest.onerror = function (event) {
          alert("Could not save image");
          console.log("Error: " + addRequest.error);
          dbConn.close();
        };
      });
    });
  }

  /**
   * Gets Image according to given index from specified resolution.
   * If Image is not present in database it gets the image from the 
   * server and then stores it in database.
   * @param {Integer} index of the image
   * @param {String} resolution from where the image needs to be fetched.
   * @param {Integer} position optional parameter which is returned as it is,
   * helps in remembering the context in which this function was invoked.
   * @returns {Promise} Promise which returns image properties on completion.
   */
  getImage(index, resolution, elevation) {
    return new Promise(function (resolve, reject) {
      indexeddb._getDbConnection().then((dbConn) => {
        let storeName = indexeddb._getObjectStoreName(resolution);
        let transaction = dbConn.transaction(storeName, "readwrite");
        let store = transaction.objectStore(storeName);
        let indexRow = index[Constant.INDEX_ROW];
        let indexCol = index[Constant.INDEX_COL];
        let getRequest = store.get([indexRow, indexCol, elevation]);
        getRequest.onsuccess = function (event) {
          let image = getRequest.result;
          let imageprops = new ImageProps();
          if (image != null && image != undefined) {
            indexeddb._blobToDataURL(image.BLOB, function (dataURL) {
              imageprops.setResolution = resolution;
              imageprops.setDataURL = dataURL;
              //imageprops.setPosition = position
              dbConn.close();
              resolve(imageprops);
            });
          } else {
            dbConn.close();
            //console.log("Fetching Image from Server...");
            Api.getImage(resolution, indexRow, indexCol, elevation)
              .then((imageDataURL) => {
                let imageprops = new ImageProps();
                //imageprops.setIndex = index
                imageprops.setResolution = resolution;
                imageprops.setDataURL = imageDataURL;
                //imageprops.setPosition = position
                indexeddb
                  .saveImage(
                    resolution,
                    indexRow,
                    indexCol,
                    elevation,
                    imageDataURL
                  )
                  .then((status) => {
                    if (status) {
                      resolve(imageprops);
                    }
                  })
                  .catch((error) => {
                    resolve(imageprops);
                    console.log("Unable to save image in indexeddb.");
                  });
              })
              .catch((error) => {
                reject(error);
              });
          }
        };
        getRequest.onerror = function (event) {
          dbConn.close();
          reject(
            new Error(
              "Unable to do get request for Image: ( " +
                indexRow +
                ", " +
                indexCol +
                " )"
            )
          );
        };
      });
    });
  }

  updateSyncStatus(totalImages, imageId, resolution, elevation) {
    return new Promise(function (resolve, reject) {
      indexeddb._getDbConnection().then((dbConn) => {
        let storeName = Constant.OBJECT_STORE_MAP[Constant.SYNC_METER];
        let transaction = dbConn.transaction(storeName, "readwrite");
        let store = transaction.objectStore(storeName);
        let addRequest = store.put({
          KEY: Constant.SYNC_STATUS,
          TOTAL_IMAGES_SYNCED: totalImages,
          LAST_IMAGE_SYNCED: imageId,
          LAST_IMAGE_SYNCED_ELE: elevation,
          LAST_IMAGE_SYNCED_RES: resolution,
        });
        transaction.oncomplete = function (event) {
          dbConn.close();
          resolve(true);
        };
        addRequest.onerror = function (event) {
          alert("Could not update sync status.");
          console.log("Error: " + addRequest.error);
          dbConn.close();
        };
      });
    });
  }

  getSyncStatus() {
    return new Promise((resolve, reject) => {
      indexeddb._getDbConnection().then((dbConn) => {
        let storeName = Constant.OBJECT_STORE_MAP[Constant.SYNC_METER];
        let transaction = dbConn.transaction(storeName, "readwrite");
        let store = transaction.objectStore(storeName);
        let getRequest = store.get([Constant.SYNC_STATUS]);
        getRequest.onsuccess = function (event) {
          let status = getRequest.result;
          if (status) {
            resolve({
              KEY: status.KEY,
              TOTAL_IMAGES_SYNCED: status.TOTAL_IMAGES_SYNCED,
              LAST_IMAGE_SYNCED: status.LAST_IMAGE_SYNCED,
              LAST_IMAGE_SYNCED_ELE: status.LAST_IMAGE_SYNCED_ELE,
              LAST_IMAGE_SYNCED_RES: status.LAST_IMAGE_SYNCED_RES,
            });
          } else {
            resolve({});
          }
        };
        getRequest.onerror = function (event) {
          reject(new Error("Unable to get sync status."));
        };
      });
    });
  }

  //****Warning****
  //function to clear contents of given object store
  clearObjectStore(dimension) {
    indexeddb._getDbConnection().then((dbConn) => {
      let storeName = indexeddb._getObjectStoreName(dimension);
      let transaction = dbConn.transaction(storeName, "readwrite");
      let store = transaction.objectStore(storeName);
      store.clear();
    });
  }

  getRecordsOfGivenObjectStore(dimension) {
    return new Promise(function (resolve, reject) {
      indexeddb._getDbConnection().then((dbConn) => {
        let storeName = indexeddb._getObjectStoreName(dimension);
        let transaction = dbConn.transaction(storeName, "readwrite");
        let store = transaction.objectStore(storeName);
        resolve(store.getAll());
      });
    });
  }

  /**
   * Update properties of resoultions in Collections Store
   * It calls server to get count of images for each resolution
   */
  updateCollections() {
    let resolutions = [
      Constant.ONE_METER,
      Constant.FIVE_METER,
      Constant.TEN_METER,
      Constant.TWENTY_FIVE_METER,
      Constant.FIFTY_METER,
    ];
    resolutions.forEach(function (resolution, index) {
      indexeddb._getDbConnection().then((dbConn) => {
        indexeddb._addCollectionEntry(
          Constant.ELEVATION_BUILDINGS,
          resolution,
          dbConn
        );
      });
    });
    resolutions.forEach(function (resolution, index) {
      indexeddb._getDbConnection().then((dbConn) => {
        indexeddb._addCollectionEntry(
          Constant.ELEVATION_BARE_EARTH,
          resolution,
          dbConn
        );
      });
    });
  }

  getCollectionSubImageDimension(resolution) {
    let resStoreName = indexeddb._getObjectStoreName(resolution);
    return new Promise((resolve, reject) => {
      indexeddb._getDbConnection().then((dbConn) => {
        let storeName = Constant.dbStoresMap[Constant.COLLECTIONS];
        let transaction = dbConn.transaction(storeName, "readwrite");
        let store = transaction.objectStore(storeName);
        let getRequest = store.get(resStoreName);
        getRequest.onsuccess = function (event) {
          let collection = getRequest.result;
          resolve(collection.subImageDimension);
        };
        getRequest.onerror = function (event) {
          reject(
            new Error(
              "Unable to get sub image dimension from collection: " + resolution
            )
          );
        };
      });
    });
  }

  _addCollectionEntry(elevation, resolution, dbConn) {
    let storeName = Constant.OBJECT_STORE_MAP[Constant.COLLECTIONS];
    Api.getStats(elevation, resolution)
      .then((stats) => {
        let transaction = dbConn.transaction(storeName, "readwrite");
        let store = transaction.objectStore(storeName);
        store.put({
          ELEVATION: elevation,
          RESOLUTION: resolution,
          SCALE: Constant.SCALE_MAP[resolution],
          numberOfImages: stats[Constant.TOTAL_IMAGES],
        });
        dbConn.close();
      })
      .catch((error) => {
        dbConn.close();
        console.log(error);
      });
  }

  _getObjectStoreName(name) {
    for (var [key, value] of indexeddb._resStoreNameMap) {
      if (value == name) {
        return key;
      }
    }
  }
}

const indexeddb = new IndexedDb();
export default indexeddb;
