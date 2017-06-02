/**
 * Created by lkabongo on 05/07/2016.
 * Requires jQuery, dat.GUI and X3DOM.
 */
var X3DOMControls = function () {
    this.windowCenter = 0;
    this.windowWidth = 0;
};

var x3domcontrols = new X3DOMControls();

// Store the DICOM images Window Center and Window With for all series (last one kept) for TF adjustments
var CURRENT_IMAGE_WINDOWCENTER = 0, CURRENT_IMAGE_WINDOWWIDTH = 0;

// Store the DICOM images spacing (last one kept) for all series for transform adjustments
var CURRENT_IMAGE_SPACING = [1.0, 1.0, 1.0];

// Store the global javascript timeouts used for triggering X3DOM refresh
var CURRENT_TIMEOUT_ATLAS, CURRENT_TIMEOUT_TF;

// Store the series minimum and maximum values
// NOTE: we store the value after applying slope/intercept that could change in different slices of the same series
var CURRENT_SERIES_MIN, CURRENT_SERIES_MAX;

// Converts DICOM pixel data to image gray pixels and puts then into an HTML Image Canvas
function fillImageDataWithCornerstoneImage(image) {
    var dicomPixels = image.getPixelData();
    var rgbaPixels = new Uint8ClampedArray(4 * dicomPixels.length);

    CURRENT_SERIES_MIN = Math.min(CURRENT_SERIES_MIN, image.slope * image.minPixelValue + image.intercept);
    CURRENT_SERIES_MAX = Math.max(CURRENT_SERIES_MAX, image.slope * image.maxPixelValue + image.intercept);

    // For each pixel in current image
    for (var i = 0; i < dicomPixels.length; i++) {
        // To Hounsfield Units (for CT)
        var HU = image.slope * dicomPixels[i] + image.intercept;

        // Apply Window/Level
        var wlHU = (((HU - (CURRENT_IMAGE_WINDOWCENTER - 0.5)) / (CURRENT_IMAGE_WINDOWWIDTH - 1.0)) + 0.5) * 255.0;

        // Store in new array
        rgbaPixels[4 * i + 0] = wlHU;
        rgbaPixels[4 * i + 1] = wlHU;
        rgbaPixels[4 * i + 2] = wlHU;
        rgbaPixels[4 * i + 3] = 255;
    }

    // Create a new image data with new array contents
    var voxelImageData = new ImageData(image.width, image.height);
    voxelImageData.data.set(rgbaPixels);

    // Create a new temporary canvas and fill it with image data
    var tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = image.width;
    tmpCanvas.height = image.height;
    var tmpCtx = tmpCanvas.getContext("2d");
    tmpCtx.putImageData(voxelImageData, 0, 0);
    return tmpCanvas;
}

// Refreshes X3DOM to take into account new atlas contents and dimensions
function doRefresh() {
    document.getElementById("voxelAtlas")._x3domNode.invalidateGLObject();
    // Normalize spacing to fit in a 1.0^3 box
    var maxCurrentImageSpacing = Math.max.apply(null, CURRENT_IMAGE_SPACING);
    CURRENT_IMAGE_SPACING = CURRENT_IMAGE_SPACING.map(function (x) {
        return x / maxCurrentImageSpacing;
    });
    document.getElementById("volumeTransform").setAttribute("scale", CURRENT_IMAGE_SPACING[0] + "," + CURRENT_IMAGE_SPACING[1] + "," + CURRENT_IMAGE_SPACING[2]);
}

// Applies the corresponding portion of the TF depending on current WW/WC values
function applyColor() {
    if (x3domcontrols !== undefined) { //TODO: should be defined in this file
        x3domcontrols.windowCenter = CURRENT_IMAGE_WINDOWCENTER;
        x3domcontrols.windowWidth = CURRENT_IMAGE_WINDOWWIDTH;
    }
}

// Triggers delayed refresh of TF and ATLAS
function launchRefresh() {
    //clearTimeout(CURRENT_TIMEOUT_ATLAS);
    //clearTimeout(CURRENT_TIMEOUT_TF);
    //CURRENT_TIMEOUT_ATLAS = setTimeout(doRefresh, 300);
    //CURRENT_TIMEOUT_TF = setTimeout(applyColor,1000);
}

// Draws a list of files into an 2D context with given width/height
function filesToAtlas(files, atlas2DContext, atlas_width, atlas_height, callback_finished, desiredWindowCenter, desiredWindowWidth) {
    // Compute how many slices fit along X and Y axis
    var slicesOverX = Math.ceil(Math.sqrt(files.length));
    var slicesOverY = Math.ceil(Math.sqrt(files.length));

    // Resulting slice width/height within atlas
    var newSliceWidth = atlas_width / slicesOverX, newSliceHeight = atlas_height / slicesOverY;

    // Stores the used image IDs
    var imageIds = [];
    for (var i = 0; i < files.length; i++) {
        // Creates an ID for drop file
        var imageId = cornerstoneWADOImageLoader.fileManager.add(files[i]);
        imageIds.push(imageId);

        // Load image (promise) with cornerstone
        cornerstone.loadAndCacheImage(imageId).then(function (image) {
                // Get current slice number and compute its corresponding position in the atlas
                var nSlice = imageIds.indexOf(image.imageId);
                var posX = nSlice % slicesOverX;
                var posY = Math.floor(nSlice / slicesOverX);

                // Take current image WW/WC
                if (desiredWindowCenter === undefined)
                    CURRENT_IMAGE_WINDOWCENTER = image.windowCenter;
                else CURRENT_IMAGE_WINDOWCENTER = desiredWindowCenter;
                if (desiredWindowWidth === undefined)
                    CURRENT_IMAGE_WINDOWWIDTH = image.windowWidth;
                else CURRENT_IMAGE_WINDOWWIDTH = desiredWindowWidth;

                // Initialize current series histogram, min and max values
                CURRENT_SERIES_HISTOGRAM = {};
                CURRENT_SERIES_MIN = Number.MAX_SAFE_INTEGER;
                CURRENT_SERIES_MAX = Number.MIN_SAFE_INTEGER;

                // Fills a temporary canvas with DICOM pixels converted to gray image
                var tmpCanvas = fillImageDataWithCornerstoneImage(image);
                atlas2DContext.drawImage(tmpCanvas, 0, 0, image.width, image.height, posX * newSliceWidth, posY * newSliceHeight, newSliceWidth, newSliceHeight);
                cornerstone.imageCache.removeImagePromise(image.imageId);// Save memory by removing image from cache

                // Adjusts spacing for volume's 3D aspect ratio (according to current image only)
                CURRENT_IMAGE_SPACING[0] = image.columns * image.columnPixelSpacing;
                CURRENT_IMAGE_SPACING[1] = image.rows * image.rowPixelSpacing;
                CURRENT_IMAGE_SPACING[2] = files.length * Number(image.data.string('x00180050'));

                // Trigger delayed refresh
                //launchRefresh();

                if ((nSlice + 1) == files.length) {
                    callback_finished();
                    doRefresh();
                    applyColor();
                }
            }
        );
    }
}
