goog.provide('main');

goog.require('spriter');
goog.require('atlas');

main.start = function ()
{
	document.body.style.margin = '0px';
	document.body.style.border = '0px';
	document.body.style.padding = '0px';
	document.body.style.overflow = 'hidden';
	document.body.style.fontFamily = '"PT Sans",Arial,"Helvetica Neue",Helvetica,Tahoma,sans-serif';

	var controls = document.createElement('div');
	controls.style.position = 'absolute';
	document.body.appendChild(controls);

	var add_checkbox_control = function (text, checked, callback)
	{
		var control = document.createElement('div');
		var input = document.createElement('input');
		input.type = 'checkbox';
		input.checked = checked;
		input.addEventListener('click', function () { callback(this.checked); }, false);
		control.appendChild(input);
		var label = document.createElement('label');
		label.innerHTML = text;
		control.appendChild(label);
		controls.appendChild(control);
	}

	var messages = document.createElement('div');
	messages.style.position = 'absolute';
	messages.style.left = '0px';
	messages.style.right = '0px';
	messages.style.bottom = '0px';
	messages.style.textAlign = 'center';
	messages.style.zIndex = -1; // behind controls
	document.body.appendChild(messages);

	var canvas = document.createElement('canvas');
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	canvas.style.position = 'absolute';
	canvas.style.width = canvas.width + 'px';
	canvas.style.height = canvas.height + 'px';
	canvas.style.zIndex = -1; // behind controls
	
	document.body.appendChild(canvas);

	var ctx = canvas.getContext('2d');

	window.addEventListener('resize', function ()
	{
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
		canvas.style.width = canvas.width + 'px';
		canvas.style.height = canvas.height + 'px';
	});

	var canvas_gl = document.createElement('canvas');
	canvas_gl.width = window.innerWidth;
	canvas_gl.height = window.innerHeight;
	canvas_gl.style.position = 'absolute';
	canvas_gl.style.width = canvas_gl.width + 'px';
	canvas_gl.style.height = canvas_gl.height + 'px';
	canvas_gl.style.zIndex = -2; // behind 2D context canvas

	document.body.appendChild(canvas_gl);

	var gl = canvas_gl.getContext('webgl') || canvas_gl.getContext('experimental-webgl');

	window.addEventListener('resize', function ()
	{
		canvas_gl.width = window.innerWidth;
		canvas_gl.height = window.innerHeight;
		canvas_gl.style.width = canvas_gl.width + 'px';
		canvas_gl.style.height = canvas_gl.height + 'px';
	});

	var positions = new Float32Array([ -1, -1,  1, -1,  1,  1, -1,  1 ]);
	var texcoords = new Float32Array([  0,  1,  1,  1,  1,  0,  0,  0 ]);
	var triangles = new Float32Array([ 0, 1, 2, 0, 2, 3 ]);

	if (gl)
	{
		var gl_projection = mat3x3Identity(new Float32Array(9));
		var gl_modelview = mat3x3Identity(new Float32Array(9));
		var gl_texmatrix = mat3x3Identity(new Float32Array(9));
		var gl_color = vec4Identity(new Float32Array(4));
		var gl_shader_vs_src = 
		[
			"precision mediump int;",
			"precision mediump float;",
			"uniform mat3 uProjection;",
			"uniform mat3 uModelview;",
			"uniform mat3 uTexMatrix;",
			"attribute vec4 aVertex;", // [ x, y, u, v ]
			"varying vec3 vTextureCoord;",
			"void main(void) {",
			" vTextureCoord = uTexMatrix * vec3(aVertex.zw, 1.0);",
			" gl_Position = vec4(uProjection * uModelview * vec3(aVertex.xy, 1.0), 1.0);",
			"}"
		];
		var gl_shader_fs_src = 
		[
			"precision mediump int;",
			"precision mediump float;",
			"uniform sampler2D uSampler;",
			"uniform vec4 uColor;",
			"varying vec3 vTextureCoord;",
			"void main(void) {",
			" gl_FragColor = uColor * texture2D(uSampler, vTextureCoord.st);",
			"}"
		];
		var gl_shader = glMakeShader(gl, gl_shader_vs_src, gl_shader_fs_src);
		var gl_vertex_array = 
		[ // x,  y, u, v
			-1, -1, 0, 1, 
			+1, -1, 1, 1, 
			+1, +1, 1, 0, 
			-1, +1, 0, 0
		];
		var gl_vertex = glMakeVertex(gl, new Float32Array(gl_vertex_array), 4, gl.ARRAY_BUFFER, gl.STATIC_DRAW);
	}

	var camera_x = 0;
	var camera_y = canvas.height/3;
	var camera_zoom = 2;

	var enable_render_webgl = !!gl;
	var enable_render_ctx2d = !!ctx && !enable_render_webgl;

	add_checkbox_control("GL", enable_render_webgl, function (checked) { enable_render_webgl = checked; });
	add_checkbox_control("2D", enable_render_ctx2d, function (checked) { enable_render_ctx2d = checked; });

	var enable_render_debug_pose = false;

	add_checkbox_control("2D Debug Pose", enable_render_debug_pose, function (checked) { enable_render_debug_pose = checked; });

	var spriter_pose = null;
	var atlas_data = null;
	var images = {};
	var gl_textures = {};

	var anim_time = 0;
	var anim_length = 0;
	var anim_rate = 1;
	var anim_repeat = 2;

	var loadFile = function (file, callback)
	{
		//render_ctx2d.dropPose(spriter_pose, atlas_data);
		//render_webgl.dropPose(spriter_pose, atlas_data);

		spriter_pose = null;
		atlas_data = null;

		var file_path = file.path;
		var file_scml_url = file_path + file.scml_url;
		var file_atlas_url = (file.atlas_url)?(file_path + file.atlas_url):("");

		loadText(file_scml_url, function (err, text)
		{
			if (err)
			{
				callback();
				return;
			}

			var parser = new DOMParser();
			var xml = parser.parseFromString(text, 'text/xml');
			var json_text = xml2json(xml, '\t');

			spriter_pose = new spriter.Pose(new spriter.Data().load(JSON.parse(json_text)));

			loadText(file_atlas_url, function (err, atlas_text)
			{
				var counter = 0;
				var counter_inc = function () { counter++; }
				var counter_dec = function ()
				{
					if (--counter === 0)
					{
						//render_ctx2d.loadPose(spriter_pose, atlas_data, images);
						//render_webgl.loadPose(spriter_pose, atlas_data, images);
						callback();
					}
				}

				counter_inc();

				if (!err && atlas_text)
				{
					atlas_data = new atlas.Data().importTPS(atlas_text);

					// load atlas page images
					var dir_path = file_atlas_url.slice(0, file_atlas_url.lastIndexOf('/'));
					atlas_data.pages.forEach(function (page)
					{
						var image_key = page.name;
						var image_url = dir_path + "/" + image_key;
						counter_inc();
						var image = images[image_key] = loadImage(image_url, (function (page) { return function (err, image)
						{
							if (err)
							{
								console.log("error loading:", image.src);
							}
							page.w = page.w || image.width;
							page.h = page.h || image.height;
							if (gl)
							{
								var gl_texture = gl_textures[image_key] = gl.createTexture();
								gl.bindTexture(gl.TEXTURE_2D, gl_texture);
								gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
								gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
								gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
								gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
								gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
							}
							counter_dec();
						}})(page));
					});
				}
				else
				{
					spriter_pose.data.folder_array.forEach(function (folder)
					{
						folder.file_array.forEach(function (file)
						{
							var image_key = file.name;
							counter_inc();
							var image = images[image_key] = loadImage(file_path + file.name, function (err, image)
							{
								if (err)
								{
									console.log("error loading:", image.src);
								}
								if (gl)
								{
									var gl_texture = gl_textures[image_key] = gl.createTexture();
									gl.bindTexture(gl.TEXTURE_2D, gl_texture);
									gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
									gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
									gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
									gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
									gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
								}
								counter_dec();
							});
						});
					});
				}

				counter_dec();
			});
		});
	}

	var files = [];

	var add_file = function (path, scml_url, atlas_url)
	{
		var file = {};
		file.path = path;
		file.scml_url = scml_url;
		file.atlas_url = atlas_url || "";
		files.push(file);
	}

	add_file("GreyGuy/", "player.scml", "player.tps.json");

	var file_index = 0;
	var entity_index = 0;
	var anim_index = 0;

	var loading = false;

	var file = files[file_index];
	messages.innerHTML = "loading";
	loading = true; loadFile(file, function ()
	{
		loading = false;
		var entity_keys = spriter_pose.getEntityKeys();
		spriter_pose.setEntity(entity_keys[entity_index = 0]);
		var anim_keys = spriter_pose.getAnimKeys();
		spriter_pose.setAnim(anim_keys[anim_index = 0]);
		spriter_pose.setTime(anim_time = 0);
		anim_length = spriter_pose.curAnimLength() || 1000;
	});

	var prev_time = 0;

	var loop = function (time)
	{
		requestAnimationFrame(loop);

		var dt = time - (prev_time || time); prev_time = time; // ms

		if (!loading)
		{
			spriter_pose.update(dt * anim_rate);

			anim_time += dt * anim_rate;

			var entity_keys = spriter_pose.getEntityKeys();
			var anim_keys = spriter_pose.getAnimKeys();

			if (anim_time >= (anim_length * anim_repeat))
			{
				if (++anim_index >= anim_keys.length)
				{
					anim_index = 0;
					if (++entity_index >= entity_keys.length)
					{
						entity_index = 0;
						if (files.length > 1)
						{
							if (++file_index >= files.length)
							{
								file_index = 0;
							}
							file = files[file_index];
							messages.innerHTML = "loading";
							loading = true; loadFile(file, function ()
							{
								loading = false;
								spriter_pose.setEntity(entity_keys[entity_index = 0]);
								spriter_pose.setAnim(anim_keys[anim_index = 0]);
								spriter_pose.setTime(anim_time = 0);
								anim_length = spriter_pose.curAnimLength() || 1000;
							});
							return;
						}
					}
					spriter_pose.setEntity(entity_keys[entity_index]);
				}
				spriter_pose.setAnim(anim_keys[anim_index]);
				spriter_pose.setTime(anim_time = 0);
				anim_length = spriter_pose.curAnimLength() || 1000;
			}

			messages.innerHTML = "entity: " + entity_keys[entity_index] + ", anim: " + anim_keys[anim_index] + "<br>" + file.path + file.scml_url;
		}

		if (ctx)
		{
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		}

		if (gl)
		{
			gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);
		}

		if (loading) { return; }

		spriter_pose.strike();

		if (ctx)
		{
			// origin at center, x right, y up
			ctx.translate(ctx.canvas.width/2, ctx.canvas.height/2); ctx.scale(1, -1);

			if (enable_render_ctx2d && enable_render_webgl)
			{
				ctx.translate(-ctx.canvas.width/4, 0);
			}

			ctx.translate(-camera_x, -camera_y);
			ctx.scale(camera_zoom, camera_zoom);
			ctx.lineWidth = 1 / camera_zoom;

			if (enable_render_ctx2d)
			{
				spriter_pose.object_array.forEach(function (object)
				{
					var folder = spriter_pose.data.folder_array[object.folder_index];
					var file = folder.file_array[object.file_index];
					var site = atlas_data && atlas_data.sites[file.name];
					var page = site && atlas_data.pages[site.page];
					var image_key = (page && page.name) || file.name;
					var image = images[image_key];
					if (image && image.complete)
					{
						ctx.save();
						ctxApplySpace(ctx, object.world_space);
						ctx.scale(file.width/2, file.height/2);
						ctxApplyAtlasSitePosition(ctx, site);
						ctx.globalAlpha = object.alpha;
						ctxDrawImageMesh(ctx, triangles, positions, texcoords, image, site, page);
						ctx.restore();
					}
				});
			}

			if (enable_render_debug_pose)
			{
				spriter_pose.bone_array.forEach(function (bone)
				{
					ctx.save();
					ctxApplySpace(ctx, bone.world_space);
					ctxDrawPoint(ctx);
					ctx.restore();
				});

				spriter_pose.object_array.forEach(function (object)
				{
					var folder = spriter_pose.data.folder_array[object.folder_index];
					var file = folder.file_array[object.file_index];
					var site = atlas_data && atlas_data.sites[file.name];
					var page = site && atlas_data.pages[site.page];
					var image_key = (page && page.name) || file.name;
					var image = images[image_key];
					ctx.save();
					ctxApplySpace(ctx, object.world_space);
					ctx.scale(file.width/2, file.height/2);
					ctx.lineWidth = 1 / Math.min(file.width/2, file.height/2);
					ctxApplyAtlasSitePosition(ctx, site);
					ctxDrawMesh(ctx, triangles, positions);
					ctx.restore();
				});
			}
		}

		if (gl)
		{
			mat3x3Identity(gl_projection);
			mat3x3Ortho(gl_projection, -gl.canvas.width/2, gl.canvas.width/2, -gl.canvas.height/2, gl.canvas.height/2);

			if (enable_render_ctx2d && enable_render_webgl)
			{
				mat3x3Translate(gl_projection, gl.canvas.width/4, 0);
			}

			mat3x3Translate(gl_projection, -camera_x, -camera_y);
			mat3x3Scale(gl_projection, camera_zoom, camera_zoom);

			if (enable_render_webgl)
			{
				gl.enable(gl.BLEND);
				gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

				spriter_pose.object_array.forEach(function (object)
				{
					var folder = spriter_pose.data.folder_array[object.folder_index];
					var file = folder.file_array[object.file_index];
					var site = atlas_data && atlas_data.sites[file.name];
					var page = site && atlas_data.pages[site.page];
					var image_key = (page && page.name) || file.name;
					var image = images[image_key];
					var gl_texture = gl_textures[image_key];
					if (image && image.complete && gl_texture)
					{
						mat3x3Identity(gl_modelview);
						mat3x3ApplySpace(gl_modelview, object.world_space);
						mat3x3Scale(gl_modelview, file.width/2, file.height/2);
						mat3x3ApplyAtlasSitePosition(gl_modelview, site);
						mat3x3Identity(gl_texmatrix);
						mat3x3ApplyAtlasPageTexcoord(gl_texmatrix, page);
						mat3x3ApplyAtlasSiteTexcoord(gl_texmatrix, site);
						vec4Identity(gl_color); gl_color[3] = object.alpha;
						gl.useProgram(gl_shader.program);
						gl.uniformMatrix3fv(gl_shader.uniforms['uProjection'], false, gl_projection);
						gl.uniformMatrix3fv(gl_shader.uniforms['uModelview'], false, gl_modelview);
						gl.uniformMatrix3fv(gl_shader.uniforms['uTexMatrix'], false, gl_texmatrix);
						gl.uniform4fv(gl_shader.uniforms['uColor'], gl_color);
						gl.activeTexture(gl.TEXTURE0);
						gl.bindTexture(gl.TEXTURE_2D, gl_texture);
						gl.uniform1i(gl_shader.uniforms['uSampler'], 0);
						glSetupAttribute(gl, gl_shader, 'aVertex', gl_vertex);
						gl.drawArrays(gl.TRIANGLE_FAN, 0, gl_vertex.count);
						glResetAttribute(gl, gl_shader, 'aVertex', gl_vertex);
					}
				});
			}
		}
	}

	requestAnimationFrame(loop);
}

function loadText (url, callback)
{
	var req = new XMLHttpRequest();
	if (url)
	{
		req.open("GET", url, true);
		req.responseType = 'text';
		req.addEventListener('error', function (event) { callback("error", null); }, false);
		req.addEventListener('abort', function (event) { callback("abort", null); }, false);
		req.addEventListener('load', function (event) { callback(null, req.response); }, false);
		req.send();
	}
	else
	{
		callback("error", null);
	}
	return req;
}

function loadImage (url, callback)
{
	var image = new Image();
	image.crossOrigin = "Anonymous";
	image.addEventListener('error', function (event) { callback("error", null); }, false);
	image.addEventListener('abort', function (event) { callback("abort", null); }, false);
	image.addEventListener('load', function (event) { callback(null, image); }, false);
	image.src = url;
	return image;	
}

function ctxApplySpace (ctx, space)
{
	if (space)
	{
		ctx.translate(space.position.x, space.position.y);
		ctx.rotate(space.rotation.rad);
		ctx.scale(space.scale.x, space.scale.y);
	}
}

function ctxApplyAtlasSitePosition (ctx, site)
{
	if (site)
	{
		ctx.scale(1 / site.original_w, 1 / site.original_h);
		ctx.translate(2*site.offset_x - (site.original_w - site.w), (site.original_h - site.h) - 2*site.offset_y);
		ctx.scale(site.w, site.h);
	}
}

function ctxDrawCircle (ctx, color, scale)
{
	scale = scale || 1;
	ctx.beginPath();
	ctx.arc(0, 0, 12*scale, 0, 2*Math.PI, false);
	ctx.strokeStyle = color || 'grey';
	ctx.stroke();
}

function ctxDrawPoint (ctx, color, scale)
{
	scale = scale || 1;
	ctx.beginPath();
	ctx.arc(0, 0, 12*scale, 0, 2*Math.PI, false);
	ctx.strokeStyle = color || 'blue';
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(24*scale, 0);
	ctx.strokeStyle = 'red';
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(0, 24*scale);
	ctx.strokeStyle = 'green';
	ctx.stroke();
}

function ctxDrawMesh (ctx, triangles, positions, stroke_style, fill_style)
{
	ctx.beginPath();
	for (var index = 0; index < triangles.length; )
	{
		var triangle = triangles[index++]*2;
		var x0 = positions[triangle], y0 = positions[triangle+1];
		var triangle = triangles[index++]*2;
		var x1 = positions[triangle], y1 = positions[triangle+1];
		var triangle = triangles[index++]*2;
		var x2 = positions[triangle], y2 = positions[triangle+1];
		ctx.moveTo(x0, y0);
		ctx.lineTo(x1, y1);
		ctx.lineTo(x2, y2);
		ctx.lineTo(x0, y0);
	};
	if (fill_style)
	{
		ctx.fillStyle = fill_style;
		ctx.fill();
	}
	ctx.strokeStyle = stroke_style || 'grey';
	ctx.stroke();
}

function ctxDrawImageMesh (ctx, triangles, positions, texcoords, image, site, page)
{
	var site_texmatrix = new Float32Array(9);
	var site_texcoord = new Float32Array(2);
	mat3x3Identity(site_texmatrix);
	mat3x3Scale(site_texmatrix, image.width, image.height);
	mat3x3ApplyAtlasPageTexcoord(site_texmatrix, page);
	mat3x3ApplyAtlasSiteTexcoord(site_texmatrix, site);

	/// http://www.irrlicht3d.org/pivot/entry.php?id=1329
	for (var index = 0; index < triangles.length; )
	{
		var triangle = triangles[index++]*2;
		var position = positions.subarray(triangle, triangle+2);
		var x0 = position[0], y0 = position[1];
		var texcoord = mat3x3Transform(site_texmatrix, texcoords.subarray(triangle, triangle+2), site_texcoord);
		var u0 = texcoord[0], v0 = texcoord[1];

		var triangle = triangles[index++]*2;
		var position = positions.subarray(triangle, triangle+2);
		var x1 = position[0], y1 = position[1];
		var texcoord = mat3x3Transform(site_texmatrix, texcoords.subarray(triangle, triangle+2), site_texcoord);
		var u1 = texcoord[0], v1 = texcoord[1];

		var triangle = triangles[index++]*2;
		var position = positions.subarray(triangle, triangle+2);
		var x2 = position[0], y2 = position[1];
		var texcoord = mat3x3Transform(site_texmatrix, texcoords.subarray(triangle, triangle+2), site_texcoord);
		var u2 = texcoord[0], v2 = texcoord[1];

		ctx.save();
		ctx.beginPath();
		ctx.moveTo(x0, y0);
		ctx.lineTo(x1, y1);
		ctx.lineTo(x2, y2);
		ctx.closePath();
		ctx.clip();
		x1 -= x0; y1 -= y0;
		x2 -= x0; y2 -= y0;
		u1 -= u0; v1 -= v0;
		u2 -= u0; v2 -= v0;
		var id = 1 / (u1*v2 - u2*v1);
		var a = id * (v2*x1 - v1*x2);
		var b = id * (v2*y1 - v1*y2);
		var c = id * (u1*x2 - u2*x1);
		var d = id * (u1*y2 - u2*y1);
		var e = x0 - (a*u0 + c*v0);
		var f = y0 - (b*u0 + d*v0);
		ctx.transform(a, b, c, d, e, f);
		ctx.drawImage(image, 0, 0);
		ctx.restore();
	}
}

function vec4Identity (v)
{
	v[0] = v[1] = v[2] = v[3] = 1.0;
	return v;
}

function mat3x3Identity (m)
{
	m[1] = m[2] = m[3] = 
	m[5] = m[6] = m[7] = 0.0;
	m[0] = m[4] = m[8] = 1.0;
	return m;
}

function mat3x3Ortho (m, l, r, b, t)
{
	var lr = 1 / (l - r);
	var bt = 1 / (b - t);
	m[0] *= -2 * lr;
	m[4] *= -2 * bt;
	m[6] += (l + r) * lr;
	m[7] += (t + b) * bt;
	return m;
}

function mat3x3Translate (m, x, y)
{
	m[6] += m[0] * x + m[3] * y;
	m[7] += m[1] * x + m[4] * y;
	return m;
}

function mat3x3Rotate (m, angle)
{
	var c = Math.cos(angle);
	var s = Math.sin(angle);
	var m0 = m[0], m1 = m[1];
	var m3 = m[3], m4 = m[4];
	m[0] = m0 * c + m3 * s;
	m[1] = m1 * c + m4 * s;
	m[3] = m3 * c - m0 * s;
	m[4] = m4 * c - m1 * s;
	return m;
}

function mat3x3Scale (m, x, y)
{
	m[0] *= x; m[1] *= x; m[2] *= x;
	m[3] *= y; m[4] *= y; m[5] *= y;
	return m;
}

function mat3x3Transform (m, v, out)
{
	var x = m[0]*v[0] + m[3]*v[1] + m[6];
	var y = m[1]*v[0] + m[4]*v[1] + m[7];
	var w = m[2]*v[0] + m[5]*v[1] + m[8];
	var iw = (w)?(1/w):(1);
	out[0] = x * iw;
	out[1] = y * iw;
	return out;
}

function mat3x3ApplySpace (m, space)
{
	if (space)
	{
		mat3x3Translate(m, space.position.x, space.position.y);
		mat3x3Rotate(m, space.rotation.rad);
		mat3x3Scale(m, space.scale.x, space.scale.y);
	}
	return m;
}

function mat3x3ApplyAtlasPageTexcoord (m, page)
{
	if (page)
	{
		mat3x3Scale(m, 1 / page.w, 1 / page.h);
	}
	return m;
}

function mat3x3ApplyAtlasSiteTexcoord (m, site)
{
	if (site)
	{
		mat3x3Translate(m, site.x, site.y);
		if (site.rotate)
		{
			mat3x3Translate(m, 0, site.w); // bottom-left corner
			mat3x3RotateCosSin(m, 0, -1); // -90 degrees
		}
		mat3x3Scale(m, site.w, site.h);
	}
	return m;
}

function mat3x3ApplyAtlasSitePosition (m, site)
{
	if (site)
	{
		mat3x3Scale(m, 1 / site.original_w, 1 / site.original_h);
		mat3x3Translate(m, 2*site.offset_x - (site.original_w - site.w), (site.original_h - site.h) - 2*site.offset_y);
		mat3x3Scale(m, site.w, site.h);
	}
	return m;
}

function glCompileShader (gl, src, type)
{
	function flatten (array, out)
	{
		out = out || [];
		array.forEach(function (value)
		{
			if (Array.isArray(value)) { flatten(value, out); } else { out.push(value); }
		});
		return out;
	}
	src = flatten(src);
	var shader = gl.createShader(type);
	gl.shaderSource(shader, src.join('\n'));
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
	{
		src.forEach(function (line, index) { console.log(index + 1, line); });
		console.log(gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		shader = null;
	}
	return shader;
}

function glLinkProgram (gl, vs, fs)
{
	var program = gl.createProgram();
	gl.attachShader(program, vs);
	gl.attachShader(program, fs);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS))
	{
		console.log("could not link shader program");
		gl.detachShader(program, vs);
		gl.detachShader(program, fs);
		gl.deleteProgram(program);
		program = null;
	}
	return program;
}

function glGetUniforms (gl, program, uniforms)
{
	var count = /** @type {number} */ (gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS));
	for (var index = 0; index < count; ++index)
	{
		var uniform = gl.getActiveUniform(program, index);
		uniforms[uniform.name] = gl.getUniformLocation(program, uniform.name);
	}
	return uniforms;
}

function glGetAttribs (gl, program, attribs)
{
	var count = /** @type {number} */ (gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES));
	for (var index = 0; index < count; ++index)
	{
		var attrib = gl.getActiveAttrib(program, index);
		attribs[attrib.name] = gl.getAttribLocation(program, attrib.name);
	}
	return attribs;
}

function glMakeShader (gl, vs_src, fs_src)
{
	var shader = {};
	shader.vs_src = vs_src;
	shader.fs_src = fs_src;
	shader.vs = glCompileShader(gl, shader.vs_src, gl.VERTEX_SHADER);
	shader.fs = glCompileShader(gl, shader.fs_src, gl.FRAGMENT_SHADER);
	shader.program = glLinkProgram(gl, shader.vs, shader.fs);
	shader.uniforms = glGetUniforms(gl, shader.program, {});
	shader.attribs = glGetAttribs(gl, shader.program, {});
	return shader;
}

function glMakeVertex (gl, type_array, size, buffer_type, buffer_draw)
{
	var vertex = {};
	if (type_array instanceof Float32Array) { vertex.type = gl.FLOAT; }
	else if (type_array instanceof Int8Array) { vertex.type = gl.BYTE; }
	else if (type_array instanceof Uint8Array) { vertex.type = gl.UNSIGNED_BYTE; }
	else if (type_array instanceof Int16Array) { vertex.type = gl.SHORT; }
	else if (type_array instanceof Uint16Array) { vertex.type = gl.UNSIGNED_SHORT; }
	else if (type_array instanceof Int32Array) { vertex.type = gl.INT; }
	else if (type_array instanceof Uint32Array) { vertex.type = gl.UNSIGNED_INT; }
	else { vertex.type = gl.NONE; throw new Error(); }
	vertex.size = size;
	vertex.count = type_array.length / vertex.size;
	vertex.type_array = type_array;
	vertex.buffer = gl.createBuffer();
	vertex.buffer_type = buffer_type;
	vertex.buffer_draw = buffer_draw;
	gl.bindBuffer(vertex.buffer_type, vertex.buffer);
	gl.bufferData(vertex.buffer_type, vertex.type_array, vertex.buffer_draw);
	return vertex;
}

function glSetupAttribute(gl, shader, format, vertex, count)
{
	count = count || 0;
	gl.bindBuffer(vertex.buffer_type, vertex.buffer);
	if (count > 0)
	{
		var sizeof_vertex = vertex.type_array.BYTES_PER_ELEMENT * vertex.size; // in bytes
		var stride = sizeof_vertex * count;
		for (var index = 0; index < count; ++index)
		{
			var offset = sizeof_vertex * index;
			var attrib = shader.attribs[format.replace(/{index}/g, index)];
			gl.vertexAttribPointer(attrib, vertex.size, vertex.type, false, stride, offset);
			gl.enableVertexAttribArray(attrib);
		}
	}
	else
	{
		var attrib = shader.attribs[format];
		gl.vertexAttribPointer(attrib, vertex.size, vertex.type, false, 0, 0);
		gl.enableVertexAttribArray(attrib);
	}
}

function glResetAttribute(gl, shader, format, vertex, count)
{
	count = count || 0;
	if (count > 0)
	{
		for (var index = 0; index < count; ++index)
		{
			var attrib = shader.attribs[format.replace(/{index}/g, index)];
			gl.disableVertexAttribArray(attrib);
		}
	}
	else
	{
		var attrib = shader.attribs[format];
		gl.disableVertexAttribArray(attrib);
	}
}
