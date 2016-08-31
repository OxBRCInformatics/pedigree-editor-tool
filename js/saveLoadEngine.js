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

	save: function () {
		if (this._saveInProgress) {
			return;   // Don't send parallel save requests
		}

		editor.getView().unmarkAll();



		//Added by Soheil for GEL(GenomicsEngland)
		//the following line will export the diagram as JSON and pass the param as all
		var privacySetting = "all";
		var exportString = PedigreeExport.exportAsSimpleJSON(editor.getGraph().DG, privacySetting);
		debugger



		var me = this;

		var jsonData = this.serialize();

		console.log("[SAVE] data: " + Helpers.stringifyObject(jsonData));

		var svg = editor.getWorkspace().getSVGCopy();
		var svgText = svg.getSVGText();

		var savingNotification = new XWiki.widgets.Notification("Saving", "inprogress");
		//The line is commented by Soheil for GEL(GenomicEngland)
		//instead of using XWiki rest end point for saving the value into XML
		//we pass it the backend Webservice URL
		//new Ajax.Request(XWiki.currentDocument.getRestURL('objects/PhenoTips.PedigreeClass/0.xml', 'method=PUT').substring(1), {
		var webservice = new WebService();
		var href = webservice.saveDiagramToOpenClinicaPath();
		new Ajax.Request(href, {
			method: 'POST',
			onCreate: function () {
				me._saveInProgress = true;
				// Disable save and close buttons during a save
				var closeButton = $('action-close');
				var saveButton = $('action-save');
				Element.addClassName(saveButton, "disabled-menu-item");
				Element.removeClassName(saveButton, "menu-item");
				Element.addClassName(saveButton, "no-mouse-interaction");
				Element.addClassName(closeButton, "disabled-menu-item");
				Element.removeClassName(closeButton, "menu-item");
				Element.addClassName(closeButton, "no-mouse-interaction");
				// IE9 & IE10 do not support "no-mouse-interaction", so add JS to handle this
				Helpers.disableMouseclicks(closeButton);
				Helpers.disableMouseclicks(saveButton);
			},
			onComplete: function () {
				me._saveInProgress = false;
				var actionAfterSave = editor.getAfterSaveAction();
				actionAfterSave && actionAfterSave();
				// Enable save and close buttons after a save
				var closeButton = $('action-close');
				var saveButton = $('action-save');
				Element.addClassName(saveButton, "menu-item");
				Element.removeClassName(saveButton, "disabled-menu-item");
				Element.removeClassName(saveButton, "no-mouse-interaction");
				Element.addClassName(closeButton, "menu-item");
				Element.removeClassName(closeButton, "disabled-menu-item");
				Element.removeClassName(closeButton, "no-mouse-interaction");
				// remove IE9/IE10 specific handlers
				Helpers.enableMouseclicks(closeButton);
				Helpers.enableMouseclicks(saveButton);
			},
			onSuccess: function () {
				editor.getUndoRedoManager().addSaveEvent();
				savingNotification.replace(new XWiki.widgets.Notification("Successfully saved"));
			},
			parameters: {"property#data": jsonData, "property#image": svgText,
					     "property#export": exportString //The line is added by Soheil for GEL(GenomicEngland), to return the JSON value
				}

		});
	},

	//probandDataObj passed to set  the probandData from the result content returned by the webservice
	load: function(probandDataObj) {
		console.log("initiating load process");

		//CALL OpenClinica service to load it ******************************************
		//******************************************************************************
		//******************************************************************************



		//This line is commented by Soheil for GEL(GenomicsEngland)
		//we load the pedigree diagram JSON from backend webservice instead of xWiki XML
		//new Ajax.Request(XWiki.currentDocument.getRestURL('objects/PhenoTips.PedigreeClass/0.xml').substring(1), {
		var webservice = new WebService();
		var path = webservice.getDiagramFromOpenClinicaPath();
		new Ajax.Request(path, {
			method: 'GET',
			onCreate: function () {
				document.fire("pedigree:load:start");
			},
			onSuccess: function (response) {


				//These lines are added by Soheil for GEL(GenomicsEngland)
				//These will set the proband details into probandDataObj
				probandDataObj.probandData = {};
				for(var i = 0; i < response.responseJSON.pedigreeJSON.length;i++){
					var node = response.responseJSON.pedigreeJSON[i];
					if(node.proband != undefined && node.proband == true){
						probandDataObj.probandData.firstName = node.firstName;
						probandDataObj.probandData.lastName  = node.lastName;
						probandDataObj.probandData.gender    = node.sex;
						break;
					}
				}


				//Load a fixed default value for testing GEL(GenomicsEngland)
				var jsonContentString = '[{"id":"1","father":"2","mother":"3","sex":"male","firstName":"S","lastName":"S","externalId":"SS","birthDate":{"decade":"2010s","year":2015,"month":3,"day":1},"hpoTerms":[],"nodeNumber":"III-1","lifeStatus":"alive"},{"id":"2","father":"5","mother":"4","sex":"male","nodeNumber":"II-2"},{"id":"3","sex":"other","nodeNumber":"II-3"},{"id":"4","sex":"female","nodeNumber":"I-2"},{"id":"5","sex":"male","nodeNumber":"I-1"},{"id":"6","father":"5","mother":"4","sex":"unknown","lifeStatus":"unborn","twinGroup":0,"nodeNumber":"II-6"},{"id":"7","father":"5","mother":"4","sex":"unknown","twinGroup":0,"nodeNumber":"II-7"},{"id":"8","father":"5","mother":"4","sex":"unknown","lifeStatus":"unborn","nodeNumber":"II-1"},{"id":"9","sex":"unknown","nodeNumber":"II-8"},{"id":"10","father":"7","mother":"9","sex":"unknown","twinGroup":0,"nodeNumber":"III-5"},{"id":"11","father":"7","mother":"9","sex":"unknown","twinGroup":0,"nodeNumber":"III-6"},{"id":"12","sex":"unknown","nodeNumber":"III-4"},{"id":"13","father":"10","mother":"12","sex":"unknown","lifeStatus":"unborn","nodeNumber":"IV-2"},{"id":"14","father":"17","mother":"16","sex":"unknown","nodeNumber":"III-3"},{"id":"15","father":"12","mother":"14","sex":"unknown","nodeNumber":"IV-1"},{"id":"16","sex":"female","nodeNumber":"II-5"},{"id":"17","sex":"male","nodeNumber":"II-4"},{"id":"18","father":"17","mother":"16","sex":"female","nodeNumber":"III-2"}]';
				var importType = "simpleJSON";
				var importOptions = {
					"acceptUnknownPhenotypes":true,
					"externalIdMark":true,
					"markEvaluated":false
				};
				var noUndo = false;
				var centerAround0 = true;
				this.createGraphFromImportData(jsonContentString,importType,importOptions,noUndo,centerAround0);
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
	}
});