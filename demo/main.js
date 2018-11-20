goog.provide('main');
goog.require('spriter');
goog.require('RenderWebGL');

const ANIM_IDLE = 'Idle';
const ANIM_WALK = 'Walking';

main.start = function () {
    var webGlCanvas = document.getElementById('canvas');
    webGlCanvas.width = window.innerWidth;
    webGlCanvas.height = window.innerHeight;
    webGlCanvas.style.position = 'absolute';
    webGlCanvas.style.width = webGlCanvas.width + 'px';
    webGlCanvas.style.height = webGlCanvas.height + 'px';
    webGlCanvas.style.zIndex = -2;

    var gl = webGlCanvas.getContext('webgl');

    window.addEventListener('resize', function () {
        webGlCanvas.width = window.innerWidth;
        webGlCanvas.height = window.innerHeight;
        webGlCanvas.style.width = webGlCanvas.width + 'px';
        webGlCanvas.style.height = webGlCanvas.height + 'px';
    });

    var renderWebGL = new RenderWebGL(gl);

    var camera_x = 0;
    var camera_y = 230;
    var camera_zoom = 0.9;

    var spriterData = null;
    var spriterPose = null;
    var animationRate = 1;
    var alpha = 1.0;
    var files = [];

    var loadFile = function (files, callback) {
        spriterPose = null;
        var file_path = file.path;
        var file_spriter_url = file_path + file.spriter_url;
        var file_atlas_url = (file.atlas_url) ? (file_path + file.atlas_url) : ('');

        loadText(file_spriter_url, function (err, text) {
            if (err) {
                callback();
                return;
            }

            spriterData = new spriter.Data().load(JSON.parse(text));
            spriterPose = new spriter.Pose(spriterData);

            loadText(file_atlas_url, function (err, atlas_text) {
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
                                images[image_key] = loadImage(file_path + file.name, (function (file) {
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
    }; // end loadFile

    var addFile = function (path, jsonFile) {
        var file = {};
        file.path = path;
        file.spriter_url = jsonFile;
        files.push(file);
    };

    // var player = {
    //     name: 'Jeffrey',
    //     lastName = 'Way',
    //
    //     someFunction: function () {
    //         console.log(this.name);
    //     }
    // };

    addFile("player/", "player.scon");

    var file_index = 0;
    var loading = false;
    var file = files[file_index];

    loading = true;

    loadFile(file, function () {
        loading = false;
        var entityKey = spriterData.getEntityKeys()[0];
        spriterPose.setEntity(entityKey);
        spriterPose.setAnim(ANIM_IDLE);
    });
    var prevTime = 0;

    var loop = function (time) {
        requestAnimationFrame(loop);

        var dt = time - (prevTime || time);
        prevTime = time;

        if (!loading) {
            spriterPose.update(dt * animationRate);
        }

        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        if (loading) {
            return;
        }

        spriterPose.strike();
        spriterPose.object_array.forEach(function (object) {
            switch (object.type) {
                case 'sprite':
                    var bone = spriterPose.bone_array[object.parent_index];
                    if (bone) {
                        spriter.Space.combine(bone.world_space, object.local_space, object.world_space);
                    } else {
                        object.world_space.copy(object.local_space);
                    }
                    var folder = spriterData.folder_array[object.folder_index];
                    var file = folder && folder.file_array[object.file_index];
                    if (file) {
                        var offset_x = (0.5 - object.pivot.x) * file.width;
                        var offset_y = (0.5 - object.pivot.y) * file.height;
                        spriter.Space.translate(object.world_space, offset_x, offset_y);
                    }
                    break;
                default:
                    throw new Error(object.type);
            }
        });

        var gl_color = renderWebGL.gl_color;
        gl_color[3] = alpha;

        var WebGLProjection = renderWebGL.gl_projection;
        // mat4x4Identity(WebGLProjection);
        mat4x4Ortho(WebGLProjection, -gl.canvas.width / 2, gl.canvas.width / 2, -gl.canvas.height / 2, gl.canvas.height / 2, -1, 1);
        mat4x4Translate(WebGLProjection, -camera_x, -camera_y, 0);
        mat4x4Scale(WebGLProjection, camera_zoom, camera_zoom, camera_zoom);
        renderWebGL.drawPose(
            spriterPose,
            null
        );
    };// end of loop

    requestAnimationFrame(loop);
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
