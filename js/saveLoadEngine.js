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

            if (changeSet == null) throw "Unable to create a pedigree from imported data";
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


        var _this = this;

        var jsonData = this.serialize();

        console.log("[SAVE] data: " + Helpers.stringifyObject(jsonData));

        var svg = editor.getWorkspace().getSVGCopy(false);
        var svgText = svg.getSVGText();

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
            postBody: '{"jsonDiagram":' + exportString + ',"svgDiagram":' + JSON.stringify(svgText) + '}',
            onCreate: function () {

                _this._saveInProgress = true;
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
                _this._saveInProgress = false;
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
            },
            on401: function (response) {
                _this.handleSaveFail(_this, savingNotification);

                var message = _this.constructErrorMessage(response.responseJSON, response.statusText);
                _this.showUnauthorisedSaveError(message);
            },
            on0: function (response) {
                _this.handleSaveFail(_this, savingNotification);

                var message = "-- Connection Error --";
                message += "<br><br><pre>" + response.request.url.replace(/\?.+/, "");
                message += "</pre><br>Please report this to the ";
                message += _this.constructHelpdeskDetails() + "<br>--------<br>";
                _this.showSaveError(message);
            },
            onFailure: function (response) {
                _this.handleSaveFail(_this, savingNotification);

                var message = _this.constructErrorMessage(response.responseJSON, response.statusText);
                _this.showSaveError(message);
            },
            onSuccess: function (response) {
                _this._saveInProgress = false;
                editor.getUndoRedoManager().addSaveEvent();
                savingNotification.replace(new XWiki.widgets.Notification("Successfully saved"));

                //Added by Soheil for GEL(GenomicsEngland)
                //If the backend is OpenClinica and it is in adminEdit mode
                //Show the following message after each save ................................................
                var settings = new Settings();
                var config = settings.getSetting('diagramEndpoint');
                if (config.service === "openclinica") {
                    var webService = new WebService();
                    var isAdminEdit = webService.getUrlParameter("adminEdit", true);
                    if (isAdminEdit && isAdminEdit != undefined && isAdminEdit == "true") {
                        var closeFunction = function () {
                            this.dialog.show();
                            if (callback) {
                                callback();
                            }
                        };
                        editor.getOkCancelDialogue().showCustomized('Your data will be saved for later but not resubmitted to Genomics England. ' +
                            '<br>When you are ready, please resubmit the Pedigree CRF.',
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
                    debugger;
                    if (callback) {
                        callback();
                    }
                }
            }
        });
    },

    //probandDataObj passed to set  the probandData from the result content returned by the webservice
    load: function (probandDataObj) {
        console.log("initiating load process");

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
                    });
                }
            },
            on401: function (response) {
                var message = _this.constructErrorMessage(response.responseJSON, response.statusText);
                _this.showUnauthorisedLoadError(message);
            },
            on0: function (response) {
                var message = "-- Connection Error --";
                message += "<br><br><pre>" + response.request.url.replace(/\?.+/, "");
                message += "</pre><br>Please report this to the ";
                message += _this.constructHelpdeskDetails() + "<br>--------<br>";
                _this.showLoadError(message);
            },
            onFailure: function (response) {
                var message = _this.constructErrorMessage(response.responseJSON, response.statusText);
                _this.showLoadError(message);
            },
            onSuccess: function (response) {
                //These lines are added by Soheil for GEL(GenomicsEngland)
                //These will set the proband details into probandDataObj
                probandDataObj.probandData = {};
                var pedigreeJSON = response.responseJSON;
                var settings = new Settings();
                var config = settings.getSetting('diagramEndpoint');
                if (config.service == "openclinica") {
                    pedigreeJSON = response.responseJSON.pedigreeJSON;
                }

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
            }.bind(this)
        });
    },
    handleSaveFail: function (_this, savingNotification) {
        _this._saveInProgress = false;
        editor.getUndoRedoManager().addSaveEvent();
        savingNotification.replace(new XWiki.widgets.Notification("Save unsuccessful"));
    },
    showLoadError: function (reason) {
        this.showLoadErrorWithReason("!! Failed to load pedigree model !!", reason);
    },
    showUnauthorisedLoadError: function (reason) {
        this.showLoadErrorWithReason("!! User is not allowed to load pedigree model !!", reason);
    },
    showLoadErrorWithReason: function (message, reason) {
        var fullMessage = message + "<br><br>" + reason + "<br>" + "Please choose a base template.";
        editor.getOkCancelDialogue().showCustomized(fullMessage, "Error Loading Model", "Choose Template",
            function () {
                new TemplateSelector(true);
            }, null, null, null, null, true);
    },
    showSaveError: function (reason) {
        this.showSaveErrorWithReason("!! Failed to save pedigree model !!", reason);
    },
    showUnauthorisedSaveError: function (reason) {
        this.showSaveErrorWithReason("!! User is not allowed to save pedigree model !!", reason);
    },
    showSaveErrorWithReason: function (message, reason) {
        var fullMessage = message + "<br><br>" + reason;
        editor.getOkCancelDialogue().showCustomized(fullMessage, "Error Saving Model", "Close",
            function () {
            }, null, null, null, null, true);
    },
    constructErrorMessage: function (json, status) {
        var message = "-- " + status;

        if (json) {
            // All messages from Mercury contain an errorcode or a type
            if (json.errorCode || json.type) {
                message = this.constructMercuryErrorMessage(json, message);
            }
            else if (json.message) {
                message += " :: " + json.message + " --";
            }
        } else {
            message += " :: Unknown cause --";
        }
        return message + "<br>--------<br>";
    },
    constructMercuryErrorMessage: function (json, message) {
        var renderJson = {};
        if (json.message) {
            message += ' --<br><br>:: ';

            // Add the error code to the message if its missing
            // This happens for errors which aren't exceptions
            if (json.errorCode && !json.message.startsWith(json.errorCode)) {
                message += json.errorCode + " - ";
            }

            message += json.message + " ::<br>";

            if (json.exception) {
                message += this.constructExceptionSection(json.exception);
            } else if (json.type) {
                message += this.constructExceptionSection(json);
            }

            if (json.validationErrors) {
                message += this.constructJsonRenderSection(json.validationErrors, 'Please find the validation errors below');
            }
        }

        // Situation of exception response when rendering, no standard exception JSON
        else if (json.type) {
            message += " :: " + json.type;
            message += this.constructExceptionSection(json);
        }
        // Just a general catch all for unknown situation
        else {
            message += " :: Unknown Reason --";
        }

        return message;
    },
    constructExceptionSection: function (exception) {
        renderJson = {
            exception: {
                type: exception.type,
                message: exception.message
            }
        };

        if (exception.stacktrace) {
            renderJson.exception.stacktrace = exception.stacktrace;
        }

        return this.constructJsonRenderSection(renderJson, 'Please copy the below and provide to the ' + this.constructHelpdeskDetails());
    },
    constructJsonRenderSection: function (renderJson, title) {
        var message = '<br>--------<br>' + title + '<br><br>';
        message += '<pre style="text-align: left;">';
        message += JSON.stringify(renderJson, null, 2);
        message += "</pre>";
        return message;
    },
    constructHelpdeskDetails: function () {
        var contact = 'Help Desk';

        var settings = new Settings();
        var config = settings.getSetting('helpdesk');

        if (config) {
            contact = config.name;
            contact += '<br>';
            contact += config.contact.phone + " :: " + config.contact.email;
        }
        return contact;
    }
});