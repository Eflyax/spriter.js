var loadFile = function (file, renderWebGL, callback) {

    var filePath = file.path;
    var fileSpriterUrl = filePath + file.spriter_url;
    var fileAtlasUrl = (file.atlas_url) ? (filePath + file.atlas_url) : ('');

    loadText(fileSpriterUrl, function (err, text) {

        spriterData = new spriter.Data().load(JSON.parse(text));
        spriterPose = new spriter.Pose(spriterData);
        // spriter_pose_next = new spriter.Pose(spriterData);

        loadText(fileAtlasUrl, function (err, atlas_text) {
            var images = {};

            var counter = 0;
            var counter_inc = function () {
                counter++;
            };
            var counter_dec = function () {
                if (--counter === 0) {
                    renderWebGL.loadData(spriterData, null, images);
                    callback();
                }
            };

            counter_inc();

            spriterData.folder_array.forEach(function (folder) {
                folder.file_array.forEach(function (file) {
                    switch (file.type) {
                        case 'image':
                            var image_key = file.name;
                            counter_inc();
                            images[image_key] = loadImage(filePath + file.name, (function (file) {
                                return function (err, image) {
                                    if (err) {
                                        console.log("error loading:", image && image.src || file.name);
                                    }
                                    counter_dec();
                                }
                            })(file));
                            break;
                        default:
                            console.log("TODO: load", file.type, file.name);
                            break;
                    }
                });
            });

            counter_dec();
        });
    });
};

function loadText(url, callback) {
    var req = new XMLHttpRequest();
    if (url) {
        req.open("GET", url, true);
        req.responseType = 'text';
        req.addEventListener('error', function () {
            callback("error", null);
        });
        req.addEventListener('abort', function () {
            callback("abort", null);
        });
        req.addEventListener('load', function () {
                if (req.status === 200) {
                    callback(null, req.response);
                } else {
                    callback(req.response, null);
                }
            },
            false);
        req.send();
    } else {
        callback("error", null);
    }

    return req;
}

function loadImage(url, callback) {
    var image = new Image();
    image.crossOrigin = "Anonymous";
    image.addEventListener('error', function () {
        callback("error", null);
    });
    image.addEventListener('abort', function () {
        callback("abort", null);
    });
    image.addEventListener('load', function () {
        callback(null, image);
    });
    image.src = url;

    return image;
}
