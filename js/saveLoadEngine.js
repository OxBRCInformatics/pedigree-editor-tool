/**
 * SaveLoadEngine is responsible for automatic and manual save and load operations.
 *
 * @class SaveLoadEngine
 * @constructor
 */
var SaveLoadEngine = Class.create({

    initialize: function () {
        this._saveInProgress = false;
    },

    /**
     * Saves the state of the pedigree (including any user preferences and current color scheme)
     *
     * @return Serialization data for the entire graph
     */
    serialize: function () {
        var jsonObject = editor.getGraph().toJSONObject();

        jsonObject["settings"] = editor.getView().getSettings();

        return JSON.stringify(jsonObject);
    },

    createGraphFromSerializedData: function (JSONString, noUndo, centerAround0) {
        console.log("---- load: parsing data ----");
        document.fire("pedigree:load:start");

        try {
            var jsonObject = JSON.parse(JSONString);

            // load the graph model of the pedigree & node data
            var changeSet = editor.getGraph().fromJSONObject(jsonObject);

            //The following is added for GEL(GenomicsEngland) by Soheil ................................................
            //This will make remove all unRenderedNode from unRenderedNodeLegend and adds the new one if any exists
            editor._unRenderedLegend.removeAllNodes();
            var unRenderedNodes = changeSet.unRendered;
            editor._unRenderedLegend.addAllNodes(unRenderedNodes);
            editor.getWorkspace().clearMenuText();
            //..........................................................................................................

            // load/process metadata such as pedigree options and color choices
            if (jsonObject.hasOwnProperty("settings")) {
                editor.getView().loadSettings(jsonObject.settings);
            }
        }
        catch (err) {
            console.log("ERROR loading the graph: " + err);
            alert("Error loading the graph");
            document.fire("pedigree:graph:clear");
            document.fire("pedigree:load:finish");
            return;
        }

        if (!noUndo) {
            var probandJSONObject = editor.getProbandDataFromPhenotips();
            var genderOk = editor.getGraph().setProbandData(probandJSONObject);
            if (!genderOk)
                alert("Proband gender defined in Phenotips is incompatible with this pedigree. Setting proband gender to 'Unknown'");
            JSONString = this.serialize();
        }

        if (editor.getView().applyChanges(changeSet, false)) {
            editor.getWorkspace().adjustSizeToScreen();
        }

        if (centerAround0) {
            editor.getWorkspace().centerAroundNode(0);
        }

        if (!noUndo && !editor.isReadOnlyMode()) {
            editor.getUndoRedoManager().addState(null, null, JSONString);
        }

        document.fire("pedigree:load:finish");
    },

    createGraphFromImportData: function (importString, importType, importOptions, noUndo, centerAround0) {
        console.log("---- import: parsing data ----");
        document.fire("pedigree:load:start");

        try {
            var changeSet = editor.getGraph().fromImport(importString, importType, importOptions);

            //The following is added for GEL(GenomicsEngland) by Soheil ................................................
            //This will make remove all unRenderedNode from unRenderedNodeLegend and adds the new one if any exists
            editor._unRenderedLegend.removeAllNodes();
            var unRenderedNodes = changeSet.unRendered;
            editor._unRenderedLegend.addAllNodes(unRenderedNodes);
            editor.getWorkspace().clearMenuText();
            //..........................................................................................................

            if (changeSet == null) throw "unable to create a pedigree from imported data";
        }
        catch (err) {
            alert("Error importing pedigree: " + err);
            document.fire("pedigree:load:finish");
            return;
        }

        if (!noUndo) {
            var probandJSONObject = editor.getProbandDataFromPhenotips();
            var genderOk = editor.getGraph().setProbandData(probandJSONObject);
            if (!genderOk)
                alert("Proband gender defined in Phenotips is incompatible with the imported pedigree. Setting proband gender to 'Unknown'");
            JSONString = this.serialize();
        }

        if (editor.getView().applyChanges(changeSet, false)) {
            editor.getWorkspace().adjustSizeToScreen();
        }

        if (centerAround0) {
            editor.getWorkspace().centerAroundNode(0);
        }

        if (!noUndo && !editor.isReadOnlyMode()) {
            editor.getUndoRedoManager().addState(null, null, JSONString);
        }

        document.fire("pedigree:load:finish");
    },

    save: function (callback) {
        if (this._saveInProgress) {
            return;   // Don't send parallel save requests
        }

        editor.getView().unmarkAll();


        //Added by Soheil for GEL(GenomicsEngland)
        //the following line will export the diagram as JSON and pass the param as all
        var privacySetting = "all";
        var exportString = PedigreeExport.exportAsSimpleJSON(editor.getGraph().DG, privacySetting);


        var me = this;

        var jsonData = this.serialize();

        console.log("[SAVE] data: " + Helpers.stringifyObject(jsonData));

        var svg = editor.getWorkspace().getSVGCopy(false);
        var svgText = svg.getSVGText();


//		var image = $('canvas');
//		var background = image.getElementsByClassName('panning-background')[0];
//		var backgroundPosition = background.nextSibling;
//		var backgroundParent =  background.parentNode;
//		backgroundParent.removeChild(background);
//		var bbox = image.down().getBBox();

        var savingNotification = new XWiki.widgets.Notification("Saving", "inprogress");
        //The line is commented by Soheil for GEL(GenomicEngland)
        //instead of using XWiki rest end point for saving the value into XML
        //we pass it the backend Webservice URL
        //new Ajax.Request(XWiki.currentDocument.getRestURL('objects/PhenoTips.PedigreeClass/0.xml', 'method=PUT').substring(1), {
        var webservice = new WebService();
        var href = webservice.saveDiagramEndpointPath();
        new Ajax.Request(href, {
            method: 'POST',
            requestHeaders: {Accept: "application/json text/json"},
            contentType: "application/json",
            postBody:'{"jsonDiagram":'+exportString+',"svgDiagram":'+JSON.stringify(svgText)+'}',
            onCreate: function () {

                me._saveInProgress = true;
                // Disable save and close buttons during a save
                var closeButton = $('action-close');
                var saveButton = $('action-save');
                var saveAndExitButton = $('action-saveAndExit');

                Element.addClassName(saveButton, "disabled-menu-item");
                Element.removeClassName(saveButton, "menu-item");
                Element.addClassName(saveButton, "no-mouse-interaction");
                Element.addClassName(closeButton, "disabled-menu-item");
                Element.removeClassName(closeButton, "menu-item");
                Element.addClassName(closeButton, "no-mouse-interaction");


                Element.addClassName(saveAndExitButton, "disabled-menu-item");
                Element.removeClassName(saveAndExitButton, "menu-item");
                Element.addClassName(saveAndExitButton, "no-mouse-interaction");


                // IE9 & IE10 do not support "no-mouse-interaction", so add JS to handle this
                if (closeButton != null && closeButton != undefined) {
                    Helpers.disableMouseclicks(closeButton);
                }
                if (saveButton != null && saveButton != undefined) {
                    Helpers.disableMouseclicks(saveButton);
                }
                if (saveAndExitButton != null && saveAndExitButton != undefined) {
                    Helpers.disableMouseclicks(saveAndExitButton);
                }

            },
            onComplete: function (response) {
                me._saveInProgress = false;
                var actionAfterSave = editor.getAfterSaveAction();
                actionAfterSave && actionAfterSave();
                // Enable save and close buttons after a save
                var closeButton = $('action-close');
                var saveButton = $('action-save');
                var saveAndExitButton = $('action-saveAndExit');

                Element.addClassName(saveButton, "menu-item");
                Element.removeClassName(saveButton, "disabled-menu-item");
                Element.removeClassName(saveButton, "no-mouse-interaction");

                Element.addClassName(closeButton, "menu-item");
                Element.removeClassName(closeButton, "disabled-menu-item");
                Element.removeClassName(closeButton, "no-mouse-interaction");

                Element.addClassName(saveAndExitButton, "menu-item");
                Element.removeClassName(saveAndExitButton, "disabled-menu-item");
                Element.removeClassName(saveAndExitButton, "no-mouse-interaction");


                // remove IE9/IE10 specific handlers
                if (closeButton != null && closeButton != undefined) {
                    Helpers.enableMouseclicks(closeButton);
                }
                if (saveButton != null && saveButton != undefined) {
                    Helpers.enableMouseclicks(saveButton);
                }
                if (saveAndExitButton != null && saveAndExitButton != undefined) {
                    Helpers.enableMouseclicks(saveAndExitButton);
                }

                //Added for GEL(GenomicsEngland) ...............................................................
                //if it has successfully saved the result
                if (response.status == 200 || response.status == 201) {
                    //Added by Soheil for GEL(GenomicsEngland)
                    //If the backend is OpenClinica and it is in adminEdit mode
                    //Show the following message after each save ................................................
                    var settings = new Settings();
                    var config = settings.getSetting('diagramEndpoint');
                    if (config.service == "openclinica") {
                        var webService = new WebService();
                        var isAdminEdit = webService.getUrlParameter("adminEdit", true);
                        if (isAdminEdit != null && isAdminEdit != undefined && isAdminEdit == "true") {
                            var closeFunction = function () {
                                this.dialog.show();
                                if (callback) {
                                    callback();
                                }
                            };
                            editor.getOkCancelDialogue().showCustomized('Your data will be saved for later but not resubmitted to Genomics England. <br>When you are ready, please resubmit the Pedigree CRF.',
                                "Genomics England",
                                "Close", closeFunction,
                                null, null,
                                null, null, true);
                        } else {
                            if (callback) {
                                callback();
                            }
                        }
                    } else {
                        if (callback) {
                            callback();
                        }
                    }
                }
                //............................................................................................

            },
            onFailure: function (response) {
                //Added for GEL(GenomicsEngland), if an error occurs while saving, then show error message
                me._saveInProgress = false;
                editor.getUndoRedoManager().addSaveEvent();


                switch (response.status) {
                    case 404:
                        savingNotification.replace(new XWiki.widgets.Notification("Participant not found"));
                        break;
                    case 403:
                        savingNotification.replace(new XWiki.widgets.Notification("Not Authorized!"));
                        break;
                    default:
                        savingNotification.replace(new XWiki.widgets.Notification("An error occurred! Please try again later."));
                        break;
                }

            },
            onSuccess: function (response) {

                if (response.status != 200 && response.status != 201) {
                    me._saveInProgress = false;
                    editor.getUndoRedoManager().addSaveEvent();
                    savingNotification.replace(new XWiki.widgets.Notification("An error occurred! Please try again later."));
                    return;
                }

                me._saveInProgress = false;
                editor.getUndoRedoManager().addSaveEvent();
                savingNotification.replace(new XWiki.widgets.Notification("Successfully saved"));
            }
        });
    },

    //probandDataObj passed to set  the probandData from the result content returned by the webservice
    load: function (probandDataObj) {
        console.log("initiating load process");

        //CALL OpenClinica service to load it ******************************************
        //******************************************************************************
        //******************************************************************************


        //This line is commented by Soheil for GEL(GenomicsEngland)
        //we load the pedigree diagram JSON from backend webservice instead of xWiki XML
        //new Ajax.Request(XWiki.currentDocument.getRestURL('objects/PhenoTips.PedigreeClass/0.xml').substring(1), {
        var webservice = new WebService();
        var path = webservice.getDiagramEndpointPath();
        var _this = this;
        new Ajax.Request(path, {
            method: 'GET',
            requestHeaders: {Accept: "application/json text/json"},
            contentType: "application/x-www-form-urlencoded",
            onCreate: function (response) {
                document.fire("pedigree:load:start");

                //Added for GEL(GenomicsEngland).............
                //We need to stop sending Pre-flight OPTIONS request
                //http://stackoverflow.com/questions/13814739/prototype-ajax-request-being-sent-as-options-rather-than-get-results-in-501-err
                var SEND_OPTION_REQUEST = false;
                if (!SEND_OPTION_REQUEST) {
                    var t = response.transport;
                    t.setRequestHeader = t.setRequestHeader.wrap(function (original, k, v) {
                        if (/^(accept|accept-language|content-language)$/i.test(k))
                            return original(k, v);
                        if (/^content-type$/i.test(k) &&
                            /^(application\/x-www-form-urlencoded|multipart\/form-data|text\/plain)(;.+)?$/i.test(v))
                            return original(k, v);
                        return;
                    });
                }
            },
            on401:function (response) {
                var message = response.statusText;
                if (response.responseJSON != null) {
                    message = response.responseJSON.message;
                }
                _this.showUnauthorisedError(message);
            },
            onFailure: function (response) {
                var message = response.statusText;
                if (response.responseJSON != null) {
                    message = response.responseJSON.message;
                }
                _this.showLoadError(message);
            },
            onSuccess: function (response) {
                if (response.status == 0) {
                    _this.showLoadError("Unknown failure reason");
                    return;
                }

                //These lines are added by Soheil for GEL(GenomicsEngland)
                //These will set the proband details into probandDataObj
                probandDataObj.probandData = {};
                var pedigreeJSON = response.responseJSON;
                var settings = new Settings();
                var config = settings.getSetting('diagramEndpoint');
                if (config.service == "openclinica") {
                    pedigreeJSON = response.responseJSON.pedigreeJSON
                }

                // for (var i = 0; i < pedigreeJSON.length; i++) {
                //     var node = pedigreeJSON[i];
                //     if (node.proband != undefined && node.proband == true) {
                //         probandDataObj.probandData = node;
                //         var genderString = probandDataObj.probandData.sex.toLowerCase();
                //         if (genderString == "female" || genderString == "f" || genderString == "2")
                //             probandDataObj.probandData.sex = "F";
                //         else if (genderString == "male" || genderString == "m" || genderString == "1")
                //             probandDataObj.probandData.sex = "M";
                //         else if (genderString == "other" || genderString == "o" || genderString == "9")
                //             probandDataObj.probandData.sex = "O";
                //         break;
                //     }
                // }

                var jsonContentString = JSON.stringify(pedigreeJSON);

                var importType = "simpleJSON";
                var importOptions = {
                    "acceptUnknownPhenotypes": true,
                    "externalIdMark": true,
                    "markEvaluated": false
                };
                var noUndo = false;
                var centerAround0 = true;
                this.createGraphFromImportData(jsonContentString, importType, importOptions, noUndo, centerAround0);
                return;


                //console.log("Data from LOAD: >>" + response.responseText + "<<");
                if (response.responseJSON) {
                    console.log("[LOAD] recived JSON: " + Helpers.stringifyObject(response.responseJSON));

                    var updatedJSONData = editor.getVersionUpdater().updateToCurrentVersion(response.responseText);

                    this.createGraphFromSerializedData(updatedJSONData);

                    // since we just loaded data from disk data in memory is equivalent to data on disk
                    editor.getUndoRedoManager().addSaveEvent();
                } else {
                    new TemplateSelector(true);
                }
            }.bind(this)
        })
    },
    showLoadError: function(reason){
        this.showError("Failed to load pedigree model",reason);
    },
    showUnauthorisedError: function(reason){
        this.showError("User is not allowed to load pedigree model",reason);
    },
    showError: function(message, reason){
        editor.getOkCancelDialogue().showCustomized(message + "<br><br>-- " + reason +
            " --<br><br>Please choose a base template.", "Error Loading Model", "Choose Template", function () {
                new TemplateSelector(true);
            },
            null, null,
            null, null, true);
    }
});