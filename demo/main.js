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

    var spriter_data = null;
    var spriterPose = null;
    var spriter_pose_next = null;
    var atlas_data = null;

    var anim_time = 0;
    var anim_length = 0;
    var anim_length_next = 0;
    var anim_rate = 1;
    var anim_repeat = 2;

    var anim_blend = 0.0;

    var alpha = 1.0;

    var loadFile = function (file, callback) {
        renderWebGL.dropData(spriter_data);

        spriterPose = null;
        spriter_pose_next = null;
        atlas_data = null;

        var file_path = file.path;
        var file_spriter_url = file_path + file.spriter_url;
        var file_atlas_url = (file.atlas_url) ? (file_path + file.atlas_url) : ('');

        loadText(file_spriter_url, function (err, text) {
            if (err) {
                callback();
                return;
            }

            spriter_data = new spriter.Data().load(JSON.parse(text));
            spriterPose = new spriter.Pose(spriter_data);


            spriter_pose_next = new spriter.Pose(spriter_data);

            loadText(file_atlas_url, function (err, atlas_text) {
                var images = {};

                var counter = 0;
                var counter_inc = function () {
                    counter++;
                };
                var counter_dec = function () {
                    if (--counter === 0) {
                        renderWebGL.loadData(spriter_data, atlas_data, images);
                        callback();
                    }
                };

                counter_inc();

                spriter_data.folder_array.forEach(function (folder) {
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
    }

    var files = [];

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
        var entity_keys = spriter_data.getEntityKeys();
        var entity_key = entity_keys[entity_index = 0];
        spriterPose.setEntity(entity_key);
        spriter_pose_next.setEntity(entity_key);
        var anim_keys = spriter_data.getAnimKeys(entity_key);
        var anim_key = anim_keys[anim_index = 0];
        spriterPose.setAnim(anim_key);
        var anim_key_next = anim_keys[(anim_index + 1) % anim_keys.length];
        spriter_pose_next.setAnim(anim_key_next);
        spriterPose.setTime(anim_time = 0);
        spriter_pose_next.setTime(anim_time);
        anim_length = spriterPose.curAnimLength() || 1000;
        anim_length_next = spriter_pose_next.curAnimLength() || 1000;
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
        var anim_key_next;

        if (!loading) {
            spriterPose.update(dt * anim_rate);
            var anim_rate_next = anim_rate * anim_length_next / anim_length;
            spriter_pose_next.update(dt * anim_rate_next);

            anim_time += dt * anim_rate;

            if (anim_time >= (anim_length * anim_repeat)) {
                entity_keys = spriter_data.getEntityKeys();
                entity_key = entity_keys[entity_index];
                anim_keys = spriter_data.getAnimKeys(entity_key);
                if (++anim_index >= anim_keys.length) {
                    anim_index = 0;
                    if (++entity_index >= entity_keys.length) {
                        entity_index = 0;
                        if (files.length > 1) {
                            if (++file_index >= files.length) {
                                file_index = 0;
                            }
                            file = files[file_index];
                            loading = true;
                            loadFile(file, function () {
                                loading = false;
                                entity_keys = spriter_data.getEntityKeys();
                                entity_key = entity_keys[entity_index = 0];
                                spriterPose.setEntity(entity_key);
                                spriter_pose_next.setEntity(entity_key);
                                anim_keys = spriter_data.getAnimKeys(entity_key);
                                anim_key = anim_keys[anim_index = 0];
                                spriterPose.setAnim(anim_key);
                                anim_key_next = anim_keys[(anim_index + 1) % anim_keys.length];
                                spriter_pose_next.setAnim(anim_key_next);
                                spriterPose.setTime(anim_time = 0);
                                spriter_pose_next.setTime(anim_time);
                                anim_length = spriterPose.curAnimLength() || 1000;
                                anim_length_next = spriter_pose_next.curAnimLength() || 1000;
                            });
                            return;
                        }
                    }
                    entity_keys = spriter_data.getEntityKeys();
                    entity_key = entity_keys[entity_index];
                    spriterPose.setEntity(entity_key);
                    spriter_pose_next.setEntity(entity_key);
                }
                entity_keys = spriter_data.getEntityKeys();
                entity_key = entity_keys[entity_index];
                anim_keys = spriter_data.getAnimKeys(entity_key);
                anim_key = anim_keys[anim_index];
                spriterPose.setAnim(anim_key);
                anim_key_next = anim_keys[(anim_index + 1) % anim_keys.length];
                spriter_pose_next.setAnim(anim_key_next);
                spriterPose.setTime(anim_time = 0);
                spriter_pose_next.setTime(anim_time);
                anim_length = spriterPose.curAnimLength() || 1000;
                anim_length_next = spriter_pose_next.curAnimLength() || 1000;
            }

            entity_keys = spriter_data.getEntityKeys();
            entity_key = entity_keys[entity_index];
            anim_keys = spriter_data.getAnimKeys(entity_key);
            anim_key = anim_keys[anim_index];
            anim_key_next = anim_keys[(anim_index + 1) % anim_keys.length];
        }

        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        if (loading) {
            return;
        }

        spriterPose.strike();
        spriter_pose_next.strike();

        var spin = 1;

        spriterPose.bone_array.forEach(function (bone, bone_index) {
            var bone_next = spriter_pose_next.bone_array[bone_index];
            if (!bone_next) {
                return;
            }
            spriter.Space.tween(bone.local_space, bone_next.local_space, anim_blend, spin, bone.local_space);
        });

        spriterPose.object_array.forEach(function (object, object_index) {
            var object_next = spriter_pose_next.object_array[object_index];
            if (object_next) {
                return;
            }
            switch (object.type) {
                case 'bone':
                    spriter.Space.tween(object.local_space, object_next.local_space, anim_blend, spin, object.local_space);
                    break;
                default:
                    throw new Error(object.type);
            }
        });

        spriterPose.bone_array.forEach(function (bone) {
            var parent_bone = spriterPose.bone_array[bone.parent_index];
            if (parent_bone) {
                spriter.Space.combine(parent_bone.world_space, bone.local_space, bone.world_space);
            } else {
                bone.world_space.copy(bone.local_space);
            }
        });

        spriterPose.object_array.forEach(function (object) {
            switch (object.type) {
                case 'sprite':
                    var bone = spriterPose.bone_array[object.parent_index];
                    if (bone) {
                        spriter.Space.combine(bone.world_space, object.local_space, object.world_space);
                    } else {
                        object.world_space.copy(object.local_space);
                    }
                    var folder = spriter_data.folder_array[object.folder_index];
                    var file = folder && folder.file_array[object.file_index];
                    if (file) {
                        var offset_x = (0.5 - object.pivot.x) * file.width;
                        var offset_y = (0.5 - object.pivot.y) * file.height;
                        spriter.Space.translate(object.world_space, offset_x, offset_y);
                    }
                    break;
                case 'bone':
                    var bone = spriterPose.bone_array[object.parent_index];
                    if (bone) {
                        spriter.Space.combine(bone.world_space, object.local_space, object.world_space);
                    } else {
                        object.world_space.copy(object.local_space);
                    }
                    break;
                case 'box':
                    var bone = spriterPose.bone_array[object.parent_index];
                    if (bone) {
                        spriter.Space.combine(bone.world_space, object.local_space, object.world_space);
                    } else {
                        object.world_space.copy(object.local_space);
                    }
                    var entity = spriterPose.curEntity();
                    var box_info = entity.obj_info_map[object.name];
                    if (box_info) {
                        var offset_x = (0.5 - object.pivot.x) * box_info.w;
                        var offset_y = (0.5 - object.pivot.y) * box_info.h;
                        spriter.Space.translate(object.world_space, offset_x, offset_y);
                    }
                    break;
                case 'point':
                    var bone = spriterPose.bone_array[object.parent_index];
                    if (bone) {
                        spriter.Space.combine(bone.world_space, object.local_space, object.world_space);
                    } else {
                        object.world_space.copy(object.local_space);
                    }
                    break;
                case 'entity':
                    var bone = spriterPose.bone_array[object.parent_index];
                    if (bone) {
                        spriter.Space.combine(bone.world_space, object.local_space, object.world_space);
                    } else {
                        object.world_space.copy(object.local_space);
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
    };

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
