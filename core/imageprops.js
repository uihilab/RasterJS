export default class ImageProps {
  constructor() {
    //resolution of the parent image of this image
    this._resolution;
    this._index;
    this._dataURL;
    this._position;
  }

  set setResolution(resolution) {
    this._resolution = resolution;
  }

  set setIndex(index) {
    this._index = index;
  }

  set setDataURL(dataURL) {
    this._dataURL = dataURL;
  }

  set setPosition(position) {
    this._position = position;
  }

  get getResolution() {
    return this._resolution;
  }

  get getIndex() {
    return this._index;
  }

  get getDataURL() {
    return this._dataURL;
  }

  get getPosition() {
    return this._position;
  }
}
