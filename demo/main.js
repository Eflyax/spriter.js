goog.provide('main');
goog.require('spriter');
goog.require('RenderWebGL');

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
    var camera_y = 0;
    var camera_zoom = 1;

    var spriterData = null;
    var spriterPose = null;
    var anim_time = 0;
    var anim_length = 0;
    var anim_rate = 1;
    var anim_repeat = 2;
    var alpha = 1.0;
    var files = [];

    var loadFile = function (files, callback) {
        renderWebGL.dropData(spriterData);

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

            var data = new spriter.Data().load(JSON.parse(text));
            var pose = new spriter.Pose(data);
            pose.setEntity("Medieval Mage");
            pose.setAnim("Idle");

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

    var add_file = function (path, spriter_url) {
        var file = {};
        file.path = path;
        file.spriter_url = spriter_url;
        files.push(file);
    }

    add_file("player/", "player.scon");

    var file_index = 0;
    var entity_index = 0;
    var anim_index = 0;

    var loading = false;

    var file = files[file_index];

    loading = true;
    loadFile(file, function () {
        loading = false;
        var entity_keys = spriterData.getEntityKeys();

        var entity_key = entity_keys[entity_index = 0];
        spriterPose.setEntity(entity_key);
        var anim_keys = spriterData.getAnimKeys(entity_key);
        var anim_key = anim_keys[anim_index = 0];
        spriterPose.setAnim(anim_key);
        spriterPose.setTime(anim_time = 0);
        anim_length = spriterPose.curAnimLength() || 1000;
    });

    var prev_time = 0;

    var loop = function (time) {
        requestAnimationFrame(loop);

        var dt = time - (prev_time || time);
        prev_time = time;

        var entity_keys;
        var entity_key;
        var anim_keys;
        var anim_key;

        if (!loading) {
            entity_keys = spriterData.getEntityKeys();
            spriterPose.update(dt * anim_rate);
            anim_time += dt * anim_rate;
            if (anim_time >= (anim_length * anim_repeat)) {

                entity_key = entity_keys[entity_index];
                anim_keys = spriterData.getAnimKeys(entity_key);
                if (++anim_index >= anim_keys.length) {
                    anim_index = 0;
                    if (++entity_index >= entity_keys.length) {
                        entity_index = 0;
                    }
                    entity_key = entity_keys[entity_index];
                    spriterPose.setEntity(entity_key);
                }
                entity_key = entity_keys[entity_index];
                anim_keys = spriterData.getAnimKeys(entity_key);
                anim_key = anim_keys[anim_index];
                spriterPose.setAnim(anim_key);
                spriterPose.setTime(anim_time = 0);
                anim_length = spriterPose.curAnimLength() || 1000;
            }
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
        mat4x4Identity(WebGLProjection);
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
