/* @requires mapshaper-export mapshaper-mode-button */

// Export buttons and their behavior
var ExportControl = function(model) {
  var downloadSupport = typeof URL != 'undefined' && URL.createObjectURL &&
    typeof document.createElement("a").download != "undefined" ||
    !!window.navigator.msSaveBlob;
  var menu = El('#export-options');
  var anchor, blobUrl;

  if (!downloadSupport) {
    El('#export-btn').on('click', function() {
      gui.alert("Exporting is not supported in this browser");
    });
  } else {
    anchor = menu.newChild('a').attr('href', '#').node();
    exportButton("#g-geojson-btn", "geojson");
    exportButton("#g-shapefile-btn", "shapefile");
    exportButton("#g-topojson-btn", "topojson");

    model.addMode('export', turnOn, turnOff);
    new ModeButton('#export-btn', 'export', model);
  }

  function turnOn() {
    menu.show();
  }

  function turnOff() {
    menu.hide();
  }

  function exportButton(selector, format) {
    var btn = new SimpleButton(selector).active(true).on('click', onClick);
    function onClick(e) {
      btn.active(false);
      setTimeout(function() {
        exportAs(format, function(err) {
          btn.active(true);
          if (err) throw err; // error(err);
        });
      }, 10);
    }
  }

  // @done function(string|Error|null)
  function exportAs(format, done) {
    var opts = {format: format}, // TODO: implement other export opts
        editing = model.getEditingLayer(),
        dataset = editing.dataset,
        files;

    try {
      if (format != 'topojson') {
        // unless exporting TopoJSON, only output the currently selected layer
        dataset = utils.defaults({
          layers: dataset.layers.filter(function(lyr) {return lyr == editing.layer;})
        }, dataset);
      }
      files = MapShaper.exportFileContent(dataset, opts);
    } catch(e) {
      return done(e);
    }

    if (!utils.isArray(files) || files.length === 0) {
      done("Nothing to export");
    } else if (files.length == 1) {
      saveBlob(files[0].filename, new Blob([files[0].content]), done);
    } else {
      name = MapShaper.getCommonFileBase(utils.pluck(files, 'filename')) || "out";
      saveZipFile(name + ".zip", files, done);
    }
  }

  function saveBlob(filename, blob, done) {
    if (window.navigator.msSaveBlob) {
      window.navigator.msSaveBlob(blob, filename);
      done();
    }
    try {
      // revoke previous download url, if any. TODO: do this when download completes (how?)
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      blobUrl = URL.createObjectURL(blob);
    } catch(e) {
      done("Mapshaper can't export files from this browser. Try switching to Chrome or Firefox.");
      return;
    }

    // TODO: handle errors
    anchor.href = blobUrl;
    anchor.download = filename;
    var clickEvent = document.createEvent("MouseEvent");
    clickEvent.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false,
        false, false, false, 0, null);
    anchor.dispatchEvent(clickEvent);
    done();
  }

  function saveZipFile(zipfileName, files, done) {
    var toAdd = files;
    try {
      zip.createWriter(new zip.BlobWriter("application/zip"), addFile, zipError);
    } catch(e) {
      // TODO: show proper error message, not alert
      done("This browser doesn't support Zip file creation.");
    }

    function zipError(msg) {
      var str = "Error creating Zip file";
      if (msg) {
        str += ": " + (msg.message || msg);
      }
      done(str);
    }

    function addFile(archive) {
      if (toAdd.length === 0) {
        archive.close(function(blob) {
          saveBlob(zipfileName, blob, done);
        });
      } else {
        var obj = toAdd.pop(),
            blob = new Blob([obj.content]);
        archive.add(obj.filename, new zip.BlobReader(blob), function() {addFile(archive);});
      }
    }
  }
};
