/**
 * The main class of the Pedigree Editor, responsible for initializing all the basic elements of the app.
 * Contains wrapper methods for the most commonly used functions.
 * This class should be initialized only once.
 *
 * @class PedigreeEditor
 * @constructor
 */
var PedigreeEditor = Class.create({
	initialize: function () {
		//this.DEBUG_MODE = true;
		window.editor = this;

		// Available options:
		//
		//  nonStandardAdoptedOutGraphic: {true|false}   - use out-brackets for adopted out persons; default "false"
		//  hideDraggingHint:             {true|false}   - do not display the hint on top of the legend; default "false"
		//  propagateFatherLastName:      {true|false}   - auto-propagate father's last name or not; default: "true"
		//  dateDisplayFormat:            {"MDY"|"DMY"|"MY"|"MMY"}  - date display format; default "MDY"; MY = "02-2015", MMY = "Feb 2015"
		//  dateEditFormat:               {"YMD"|"DMY"|"MY"}  - defines order of fields in the date picker; default "YMD"
		//  drawNodeShadows:              {true|false}   - display small shadow under node graphic; default: "true"
		//  disabledFields:               [array]        - list of node-menu fields disabled for this installation
		//  displayCancerLabels:          {true|false}   - display labels for each afecting cancer; default: "true"
		//
		this._defaultPreferences = { global: { nonStandardAdoptedOutGraphic: false,
			propagateFatherLastName: true,
			dateDisplayFormat: "YMD",
			dateEditFormat: "YMD",
			drawNodeShadows: true,
			disabledFields: [],
			displayCancerLabels: true },
			user: { hideDraggingHint: false,
				firstName: "",
				lastName: "" },
			pedigree: {}
		};
		this._preferencesManager = new PreferencesManager(this._defaultPreferences);

		// initialize main data structure which holds the graph structure
		this._graphModel = DynamicPositionedGraph.makeEmpty(PedigreeEditorParameters.attributes.layoutRelativePersonWidth, PedigreeEditorParameters.attributes.layoutRelativeOtherWidth);

		//initialize the elements of the app
		this._workspace = new Workspace();
		this._unRenderedLegend = new unRenderedLegend();
		this._disorderLegend = new DisorderLegend();
		this._geneLegend = new GeneLegend();
		this._hpoLegend = new HPOLegend();
		this._cancerLegend = new CancerLegend();

		this._nodetypeSelectionBubble = new NodetypeSelectionBubble(false);
		this._siblingSelectionBubble = new NodetypeSelectionBubble(true);
		this._okCancelDialogue = new OkCancelDialogue();

		this._view = new View();

		this._actionStack = new UndoRedoManager();
		this._templateSelector = new TemplateSelector();
		this._saveLoadIndicator = new SaveLoadIndicator();
		this._versionUpdater = new VersionUpdater();
		this._saveLoadEngine = new SaveLoadEngine();
		this._probandData = new ProbandDataLoader();

		this._preferencesManager.load(function () {
			Helpers.copyProperties(PedigreeEditorParameters.styles.blackAndWhite, PedigreeEditorParameters.attributes);

			//The line is commented by Soheil for GEL(GenomicsEngland)
			//_saveLoadEngine will set the proband details
			//this._probandData.load( this._saveLoadEngine.load.bind(this._saveLoadEngine) );
			this._saveLoadEngine.load(this._probandData);

			// generate various dialogues after preferences have been loaded
			this._nodeMenu = this.generateNodeMenu();
			this._nodeGroupMenu = this.generateNodeGroupMenu();
			this._partnershipMenu = this.generatePartnershipMenu();
			this._importSelector = new ImportSelector();
			this._exportSelector = new ExportSelector();
			this._printDialog = new PrintDialog();
		}.bind(this));

		this._controller = new Controller();

		//attach actions to buttons on the top bar
		var undoButton = $('action-undo');
		undoButton && undoButton.on("click", function (event) {
			document.fire("pedigree:undo");
		});
		var redoButton = $('action-redo');
		redoButton && redoButton.on("click", function (event) {
			document.fire("pedigree:redo");
		});

		var autolayoutButton = $('action-layout');
		autolayoutButton && autolayoutButton.on("click", function (event) {
			document.fire("pedigree:autolayout");
		});
		var clearButton = $('action-clear');
		clearButton && clearButton.on("click", function (event) {
			document.fire("pedigree:graph:clear");
		});

		var saveButton = $('action-save');
		saveButton && saveButton.on("click", function (event) {
			editor.getSaveLoadEngine().save();
		});


		//Added for GEL(GenomicsEngland) ........................................................................
		//Add eventHandler for saveAndExit button, it should actually call save and also pass a callBack
		//which is a close function. Once the save is done, it will check if callback exists and then calls that
		var saveAndExitButton = $('action-saveAndExit');
		saveAndExitButton && saveAndExitButton.on("click", function (event) {
			editor.getSaveLoadEngine().save(onCloseButtonClickFunc);
		});
		//........................................................................................................


		var templatesButton = $('action-templates');
		templatesButton && templatesButton.on("click", function (event) {
			editor.getTemplateSelector().show();
		});
		var importButton = $('action-import');
		importButton && importButton.on("click", function (event) {
			editor.getImportSelector().show();
		});
		var exportButton = $('action-export');
		exportButton && exportButton.on("click", function (event) {
			editor.getExportSelector().show();
		});
		var printButton = $('action-print');
		printButton && printButton.on("click", function (event) {
			editor.getPrintDialog().show();
		});

		var onLeavePageFunc = function () {
			if (!editor.isReadOnlyMode() && editor.getUndoRedoManager().hasUnsavedChanges()) {
				return "All changes will be lost when navigating away from this page.";
			}
		};
		window.onbeforeunload = onLeavePageFunc;

		var onCloseButtonClickFunc = function (event) {
			var dontQuitFunc = function () {
				window.onbeforeunload = onLeavePageFunc;
			};
			var quitFunc = function () {

				//Added by Soheil for GEL(GenomicsEngland)
				//If the backend is OpenClinica, by click on Close button, got to "returnURL" which is provided in the URL
				var settings = new Settings();
				var config = settings.getSetting('diagramEndpoint');
				if(config.service == "openclinica" || config.service == "mercury"){
					var webService = new WebService();
					var returnURL = webService.getUrlParameter("returnURL", true);
					var status = webService.getUrlParameter("status", true);
					//In case of OpenClinica, if it is in new mode, the pedigree CRF might not have been saved yet,
					//and as the main CRF page is still open, so just close this
					if(config.service == "openclinica" && status == "new"){
						window.close();
						return;
					}
					//for Mercury and OpenClinica(status=edit), go to the returnURL
					if(returnURL){
						window.location = decodeURIComponent(returnURL);
					}else{
						//do nothing for now
					}
				}
				//........................................................................................
			};
			var saveAndQuitFunc = function () {
				editor._afterSaveFunc = quitFunc;
				editor.getSaveLoadEngine().save();
			}


			
			var settings = new Settings();
			var saveAndExit = settings.getSetting('saveAndExit');
			//Added for GEL(GenomicsEngland)
			//condition "saveAndExit === true" is added for GEL
			//if saveAndExit is True, it means that the save is already called successfully and we are here!
			//so we can then call quitFunc to quit the app
			if (editor.isReadOnlyMode() || saveAndExit === true) {
				quitFunc();
			} else {
				window.onbeforeunload = undefined;

				if (editor.getUndoRedoManager().hasUnsavedChanges()) {
					editor.getOkCancelDialogue().showCustomized('There are unsaved changes, do you want to save the pedigree before closing the pedigree editor?',
						'Save before closing?',
						"Save", saveAndQuitFunc,
						"Don't save", quitFunc,
						"Don't close", dontQuitFunc, true);
				} else {
					quitFunc();
				}
			}
		};
		var closeButton = $('action-close');
		this._afterSaveFunc = null;
		closeButton && (closeButton.onclick = onCloseButtonClickFunc);

		var renumberButton = $('action-number');
		renumberButton && renumberButton.on("click", function (event) {
			document.fire("pedigree:renumber");
		});

		var unsupportedBrowserButton = $('action-readonlymessage');
		unsupportedBrowserButton && unsupportedBrowserButton.on("click", function (event) {
			alert("Your browser does not support all the features required for " +
				"Pedigree Editor, so pedigree is displayed in read-only mode (and may have quirks).\n\n" +
				"Supported browsers include Firefox v3.5+, Internet Explorer v9+, " +
				"Chrome, Safari v4+, Opera v10.5+ and most mobile browsers.");
		});

		//this.startAutoSave(30);
	},

	/**
	 * @method getPreferencesManager
	 * @return {PreferencesManager}
	 */
	getPreferencesManager: function () {
		return this._preferencesManager;
	},

	/**
	 * Returns the graph node with the corresponding nodeID
	 * @method getNode
	 * @param {Number} nodeID The id of the desired node
	 * @return {AbstractNode} the node whose id is nodeID
	 */
	getNode: function (nodeID) {
		return this.getView().getNode(nodeID);
	},

	/**
	 * @method getView
	 * @return {View} (responsible for managing graphical representations of nodes and interactive elements)
	 */
	getView: function () {
		return this._view;
	},

	/**
	 * @method getVersionUpdater
	 * @return {VersionUpdater}
	 */
	getVersionUpdater: function () {
		return this._versionUpdater;
	},

	/**
	 * @method getGraph
	 * @return {DynamicPositionedGraph} (data model: responsible for managing nodes and their positions)
	 */
	getGraph: function () {
		return this._graphModel;
	},

	/**
	 * @method getController
	 * @return {Controller} (responsible for managing user input and corresponding data changes)
	 */
	getController: function () {
		return this._controller;
	},

	/**
	 * @method getUndoRedoManager
	 * @return {UndoRedoManager} (responsible for undoing and redoing actions)
	 */
	getUndoRedoManager: function () {
		return this._actionStack;
	},

	/**
	 * The action which should happen after pedigree is saved
	 * (normally null, close the editor when "save on quit")
	 */
	getAfterSaveAction: function () {
		return this._afterSaveFunc;
	},

	/**
	 * @method getOkCancelDialogue
	 * @return {OkCancelDialogue} (responsible for displaying ok/cancel prompts)
	 */
	getOkCancelDialogue: function () {
		return this._okCancelDialogue;
	},

	/**
	 * @method getNodetypeSelectionBubble
	 * @return {NodetypeSelectionBubble} (floating window with initialization options for new nodes)
	 */
	getNodetypeSelectionBubble: function () {
		return this._nodetypeSelectionBubble;
	},

	/**
	 * @method getSiblingSelectionBubble
	 * @return {NodetypeSelectionBubble} (floating window with initialization options for new sibling nodes)
	 */
	getSiblingSelectionBubble: function () {
		return this._siblingSelectionBubble;
	},

	/**
	 * @method getWorkspace
	 * @return {Workspace}
	 */
	getWorkspace: function () {
		return this._workspace;
	},

	/**
	 * @method getDisorderLegend
	 * @return {Legend} Responsible for managing and displaying the disorder legend
	 */
	getDisorderLegend: function () {
		return this._disorderLegend;
	},

	/**
	 * @method getHPOLegend
	 * @return {Legend} Responsible for managing and displaying the phenotype/HPO legend
	 */
	getHPOLegend: function () {
		return this._hpoLegend;
	},

	/**
	 * @method getGeneLegend
	 * @return {Legend} Responsible for managing and displaying the candidate genes legend
	 */
	getGeneLegend: function () {
		return this._geneLegend;
	},

	/**
	 * @method getCancerLegend
	 * @return {Legend} Responsible for managing and displaying the common cancers legend
	 */
	getCancerLegend: function () {
		return this._cancerLegend;
	},

	/**
	 * @method getPaper
	 * @return {Workspace.paper} Raphael paper element
	 */
	getPaper: function () {
		return this.getWorkspace().getPaper();
	},

	/**
	 * @method isReadOnlyMode
	 * @return {Boolean} True iff pedigree drawn should be read only with no handles
	 *                   (read-only mode is used for IE8 as well as for template display and
	 *                   print and export versions).
	 */
	isReadOnlyMode: function () {
		if (this.isUnsupportedBrowser()) return true;
		return false;
	},

	isUnsupportedBrowser: function () {
		// http://voormedia.com/blog/2012/10/displaying-and-detecting-support-for-svg-images
		if (!document.implementation.hasFeature("http://www.w3.org/TR/SVG11/feature#BasicStructure", "1.1")) {
			// implies unpredictable behavior when using handles & interactive elements,
			// and most likely extremely slow on any CPU
			return true;
		}
		// http://kangax.github.io/es5-compat-table/
		if (!window.JSON) {
			// no built-in JSON parser - can't proceed in any way; note that this also implies
			// no support for some other functions such as parsing XML.
			//
			// TODO: include free third-party JSON parser and replace XML with JSON when loading data;
			//       (e.g. https://github.com/douglascrockford/JSON-js)
			//
			//       => at that point all browsers which suport SVG but are treated as unsupported
			//          should theoreticaly start working (FF 3.0, Safari 3 & Opera 9/10 - need to test).
			//          IE7 does not support SVG and JSON and is completely out of the running;
			alert("Your browser is not supported and is unable to load and display any pedigrees.\n\n" +
				"Suported browsers include Internet Explorer version 9 and higher, Safari version 4 and higher, " +
				"Firefox version 3.6 and higher, Opera version 10.5 and higher, any version of Chrome and most " +
				"other modern browsers (including mobile). IE8 is able to display pedigrees in read-only mode.");
			window.stop && window.stop();
			return true;
		}
		return false;
	},

	/**
	 * @method getSaveLoadEngine
	 * @return {SaveLoadEngine} Engine responsible for saving and loading operations
	 */
	getSaveLoadEngine: function () {
		return this._saveLoadEngine;
	},

	/**
	 * @method getProbandDataFromPhenotips
	 * @return {firstName: "...", lastName: "..."}
	 */
	getProbandDataFromPhenotips: function () {
		return this._probandData.probandData;
	},

	/**
	 * @method getTemplateSelector
	 * @return {TemplateSelector}
	 */
	getTemplateSelector: function () {
		return this._templateSelector
	},

	/**
	 * @method getImportSelector
	 * @return {ImportSelector}
	 */
	getImportSelector: function () {
		return this._importSelector
	},

	/**
	 * @method getExportSelector
	 * @return {ExportSelector}
	 */
	getExportSelector: function () {
		return this._exportSelector
	},

	/**
	 * @method getPrintDialog
	 * @return {PrintDialog}
	 */
	getPrintDialog: function () {
		return this._printDialog;
	},

	/**
	 * Returns true if any of the node menus are visible
	 * (since some UI interactions should be disabled while menu is active - e.g. mouse wheel zoom)
	 *
	 * @method isAnyMenuVisible
	 */
	isAnyMenuVisible: function () {
		if (this.getNodeMenu().isVisible() || this.getNodeGroupMenu().isVisible() || this.getPartnershipMenu().isVisible()) {
			return;
		}
	},

	/**
	 * Creates the context menu for Person nodes
	 *
	 * @method generateNodeMenu
	 * @return {NodeMenu}
	 */
	generateNodeMenu: function () {
		if (this.isReadOnlyMode()) return null;
		var _this = this;
		var disabledFields = this.getPreferencesManager().getConfigurationOption("disabledFields");

		var fieldList = [
			{
				'name': 'identifier',
				'label': '',
				'type': 'hidden',
				'tab': 'Personal'
			},
			/*{
			 'name' : 'phenotipsid',
			 'label' : 'Phenotips Patient Link',
			 'type' : 'text', //phenotipsid-picker',
			 'tab' : 'Personal',
			 'function' : 'setPhenotipsPatientId'
			 },*/
			{
				'name': 'gender',
				'label': 'Gender',
				'type': 'select',
				'tab': 'Personal',
				'values': [
					{ 'actual': 'M', 'displayed': 'Male' },
					{ 'actual': 'F', 'displayed': 'Female' },
					{ 'actual': 'O', 'displayed': 'Other' },
					{ 'actual': 'U', 'displayed': 'Unknown' }
				],
				'default': 'U',
				'function': 'setGender'
			},
			{
				'name': 'karyotypic_sex',
				'label': 'Working Karyotypic Sex',
				'values': [
					{'actual': 'Unknown',displayed:'Unknown'},
					{'actual': 'XY',displayed:'XY'},
					{'actual': 'XX',displayed:'XX'},
					{'actual': 'XO',displayed:'XO'},
					{'actual': 'XXY',displayed:'XXY'},
					{'actual': 'XYY',displayed:'XYY'},
					{'actual': 'XXX',displayed:'XXX'},
					{'actual': 'XXYY',displayed:'XXYY'},
					{'actual': 'XXXY',displayed:'XXXY'},
					{'actual': 'XXXX',displayed:'XXXX'},
					{'actual': 'Other',displayed:'Other'}
				],
				'type': 'select',
				'tab': 'Personal',
				'function': 'setKaryotypicSex',
				'isMultipleSelect': false
			},
			{
				'name' : 'participant_id',
				'label': 'Participant ID',
				'type' : 'text',
				'tab': 'Personal',
				'function' : 'setParticipantId'
			},
			//{
			//	'name' : 'family_id',
			//	'label': 'Family ID',
			//	'type' : 'text',
			//	'tab': 'Personal',
			//	'function' : 'setFamilyId'
			//},
			{
				'name': 'gel_super_family_id',
				'label': 'GEL Super Family ID',
				'type': 'text',
				'tab': 'Personal',
				'function': 'setGelSuperFamilyId'
			},
			{
				'name' : 'nhs_number',
				'label': 'NHS Number',
				'type' : 'text',
				'tab': 'Personal',
 				'function' : 'setNHSNumber'
			},
			{
				'name' : 'chi_number',
				'label': 'CHI Number',
				'type' : 'text',
				'tab': 'Personal',
 				'function' : 'setCHINumber'
			},
			{
				'name': 'first_name',
				'label': 'First name',
				'type': 'text',
				'tab': 'Personal',
				'function': 'setFirstName'
			},
			{
				'name': 'last_name',
				'label': 'Last name',
				'type': 'text',
				'tab': 'Personal',
				'function': 'setLastName'
			},
			//commented for GEL(GenomicsEngland)
			//{
			//	'name': 'last_name_birth',
			//	'label': 'Last name at birth',
			//	'type': 'text',
			//	'tab': 'Personal',
			//	'function': 'setLastNameAtBirth'
			//},
			{
				'name': 'ethnicity',
				'label': 'Ethnicity',
				'values': [
					{'actual': 'Z',displayed:'Not stated'},
					{'actual': 'A',displayed:'White: British'},
					{'actual': 'B',displayed:'White: Irish'},
					{'actual': 'C',displayed:'White: Any other White background'},
					{'actual': 'D',displayed:'Mixed: White and Black Caribbean'},
					{'actual': 'E',displayed:'Mixed: White and Black African'},
					{'actual': 'F',displayed:'Mixed: White and Asian'},
					{'actual': 'G',displayed:'Mixed: Any other mixed background'},
					{'actual': 'H',displayed:'Asian or Asian British: Indian'},
					{'actual': 'J',displayed:'Asian or Asian British: Pakistani'},
					{'actual': 'K',displayed:'Asian or Asian British: Bangladeshi'},
					{'actual': 'L',displayed:'Asian or Asian British: Any other Asian background'},
					{'actual': 'M',displayed:'Black or Black British: Caribbean'},
					{'actual': 'N',displayed:'Black or Black British: African'},
					{'actual': 'P',displayed:'Black or Black British: Any other Black background'},
					{'actual': 'R',displayed:'Other Ethnic Groups: Chinese'},
					{'actual': 'S',displayed:'Other Ethnic Groups: Any other ethnic group'}
				],
				'type': 'select',
				'tab': 'Personal',
				'function': 'setEthnicities',
				'isMultipleSelect': false
			},
			{
				'name': 'carrier',
				'label': 'GEL disease status',
				'type': 'radio',
				'tab': 'Clinical',
				'values': [
					{ 'actual': '', 'displayed': 'Unaffected' },
					{ 'actual': 'affected', 'displayed': 'Affected' },
					{ 'actual': 'uncertain', 'displayed': 'Uncertain' }
				],
				'default': '',
				'function': 'setCarrierStatus'
			},
			{
				'label' : "<i class='fa fa-info-circle' aria-hidden='true'></i> Please select coding system for disorder search:",
				'name' : 'disorderType',
				'type' : 'select',
				'tab': 'Clinical',
				'values' : [
					{'actual': 'GEL', displayed: 'GEL Disorders'},
					{'actual': 'OMIM',  displayed: 'OMIM'},
					{'actual': 'ICD10', displayed: 'ICD10'},
					{'actual': 'SnomedCT', displayed: 'SnomedCT'}
				],
				'function' : 'setDisorderType'
			},
			{
				'label': 'Age Onset(y)',
				'name' : 'ageOfOnset',
				'type': 'text',
				'tab': 'Clinical',
				'function' : 'setAgeOfOnset'
			},
            {
                'name': 'disorders',
                'label': 'Disorder',
                'type': 'disease-picker',
                'tab': 'Clinical',
                'function': 'setDisorders'
            },
			// {
			// 	'name': 'consanguineous_population',
			// 	'label': 'Consanguineous Population',
			// 	'type': 'text',
			// 	'tab': 'Clinical',
			// 	'function': 'setConsanguineousPopulation'
			// },
			// {
			// 	'name': 'ancestries',
			// 	'label': 'Ancestries',
			// 	'type': 'textarea',
			// 	 'columns':4,
			// 	'tab': 'Clinical',
			// 	'function': 'setAncestries'
			// },

			{
				'name': 'hpo_positive',
				'label': 'Phenotype',
				'type': 'hpo-picker',
				'tab': 'Phenotype',
				'function': 'setHPO'
			},
			{
				'name' : 'hpoPresent',
				'label': 'HPO Present',
				'type': 'select',
				'tab': 'Phenotype',
				'values' : [
					{'actual': 'yes', displayed: 'Yes'},
					{'actual': 'no', displayed: 'No'},
					{'actual': 'unknown', displayed: 'Unknown'}
				],
				'function' : 'setHPOPresent'
			},
			//Commented for GEL(GenomicsEngland)
			//{
			//	'name': 'candidate_genes',
			//	'label': 'Genotype information: candidate genes',
			//	'type': 'gene-picker',
			//	'tab': 'Clinical',
			//	'function': 'setGenes'
			//},
			{
				'name': 'age_of_death_guide',
				'label': "<i class='fa fa-info-circle' aria-hidden='true'></i> Please use either 'Age of death' or 'Date of birth/death'",
				'type': 'label',
				'tab': 'Personal'
			},

			{
				'name': 'age_of_death',
				'label': "Age at death",
				'type': 'text',
				'tab': 'Personal',
				'function': 'setAgeOfDeath'
			},
			{
				'name': 'age_of_death_format',
				'label': "",
				'type': 'select',
				'tab': 'Personal',
				'function': 'setAgeOfDeathFormat',
				'values' : [
					{'actual': 'y', displayed: 'Year'},
					{'actual': 'mo', displayed: 'Month'},
					{'actual': 'wk', displayed: 'Week'},
					{'actual': 'd', displayed: 'Day'}
				]
			},
			{
				'name': 'date_of_birth',
				'label': 'Date of birth',
				'type': 'date-picker',
				'tab': 'Personal',
				'function': 'setBirthDate'
			},
			{
				'name': 'date_of_death',
				'label': 'Date of death',
				'type': 'date-picker',
				'tab': 'Personal',
				'function': 'setDeathDate'
			},

			{
				'name': 'state',
				'label': 'Individual is',
				'type': 'radio',
				'tab': 'Personal',
				'columns': 3,
				'valuesIE9': [
					// different order of options because they are displayed sequentially instead of in 3-column layout
					{ 'actual': 'alive', 'displayed': 'Alive' },
					{ 'actual': 'deceased', 'displayed': 'Deceased' },
					{ 'actual': 'stillborn', 'displayed': 'Stillborn' },
					{ 'actual': 'unborn', 'displayed': 'Unborn' },
					{ 'actual': 'miscarriage', 'displayed': 'Miscarried' },
					{ 'actual': 'aborted', 'displayed': 'Elective abortion' }
				],
				'values': [
					{ 'actual': 'alive', 'displayed': 'Alive' },
					{ 'actual': 'stillborn', 'displayed': 'Stillborn' },
					{ 'actual': 'deceased', 'displayed': 'Deceased', 'columnshiftPX': -2 },
					{ 'actual': 'miscarriage', 'displayed': 'Miscarried', 'columnshiftPX': -2},
					{ 'actual': 'unborn', 'displayed': 'Unborn', 'columnshiftPX': 8 },
					{ 'actual': 'aborted', 'displayed': 'Aborted', 'columnshiftPX': 8 }
				],
				'default': 'alive',
				'function': 'setLifeStatus'
			},
			{
				'name': 'gestation_age',
				'label': 'Gestation age',
				'type': 'select',
				'tab': 'Personal',
				'range': {'start': 0, 'end': 50, 'item': ['week', 'weeks']},
				'nullValue': true,
				'function': 'setGestationAge'
			},
			{
				'label': 'Heredity options',
				'name': 'childlessSelect',
				'values': [
					{'actual': 'none', displayed: 'None'},
					{'actual': 'childless', displayed: 'Childless'},
					{'actual': 'infertile', displayed: 'Infertile'}
				],
				'type': 'select',
				'tab': 'Personal',
				'function': 'setChildlessStatus'
			},
			{
				'name': 'childlessText',
				'type': 'text',
				'dependency': 'childlessSelect != none',
				dependencyShowInline: true,
				'tip': 'Reason',
				'tab': 'Personal',
				'function': 'setChildlessReason'
			},
			{
				'name': 'adopted',
				'label': 'Adopted status',
				'type': 'radio',
				'tab': 'Personal',
				'columns': 3,
				'values': [
					{ 'actual': '', 'displayed': 'Not adopted' },
					{ 'actual': 'adoptedIn', 'displayed': 'Adopted in' },
					{ 'actual': 'adoptedOut', 'displayed': 'Adopted out' }
				],
				'default': '',
				'function': 'setAdopted'
			},
			{
				'name': 'monozygotic',
				'label': 'Monozygotic twin',
				'type': 'checkbox',
				'tab': 'Personal',
				'function': 'setMonozygotic'
			},
			{
				'name': 'nocontact',
				'label': 'Not in contact with proband',
				'type': 'checkbox',
				'tab': 'Personal',
				'function': 'setLostContact'
			},
			{
				'name': 'placeholder',
				'label': 'Placeholder node',
				'type': 'checkbox',
				'tab': 'Personal',
				'function': 'makePlaceholder'
			},
			// {
			// 	'name': 'commentsClinical',
			// 	'label': 'Comments',
			// 	'type': 'textarea',
			// 	'tab': 'Clinical',
			// 	'function': 'setComments'
			// },
			{
				'name': 'evaluated',
				'label': 'Documented evaluation',
				'type': 'checkbox',
				'tab': 'Clinical',
				'function': 'setEvaluated'
			}
			/*,
			{   'name': 'cancers',
				'label': 'Common Cancers',
				'type': 'cancerlist',
				'tab': 'Cancers',
				'function': 'setCancers'
			},
			{
				'name': 'commentsCancers',
				'label': 'Comments',
				'type': 'textarea',
				'tab': 'Cancers',
				'rows': 2,
				'function': 'setComments'
			}*/
		];

		function isDisabled(field) {
			if (Helpers.arrayContains(disabledFields, field.name)) {
				return false;
			}
			return true;
		}

		//'Cancers' tab removed for GEL(GenomicsEngland)
		//return new NodeMenu(fieldList.filter(isDisabled), ["Personal", "Clinical", "Cancers"]);
		return new NodeMenu(fieldList.filter(isDisabled), ["Personal", "Clinical","Phenotype"]);
	},

	/**
	 * @method getNodeMenu
	 * @return {NodeMenu} Context menu for nodes
	 */
	getNodeMenu: function () {
		return this._nodeMenu;
	},

	/**
	 * Creates the context menu for PersonGroup nodes
	 *
	 * @method generateNodeGroupMenu
	 * @return {NodeMenu}
	 */
	generateNodeGroupMenu: function () {
		if (this.isReadOnlyMode()) return null;
		var _this = this;
		return new NodeMenu([
			{
				'name': 'identifier',
				'label': '',
				'type': 'hidden',
				'tab': 'Personal'
			},
			{
				'name': 'gender',
				'label': 'Gender',
				'type': 'select',
				'columns': 3,
				'values': [
					{ 'actual': 'M', 'displayed': 'Male' },
					{ 'actual': 'F', 'displayed': 'Female' },
					{ 'actual': 'O', 'displayed': 'Other' },
					{ 'actual': 'U', 'displayed': 'Unknown' }
				],
				'default': 'U',
				'tab': 'Personal',
				'function': 'setGender'
			},
			{
				'name': 'karyotypic_sex',
				'label': 'Working Karyotypic Sex',
				'values': [
					{'actual': 'Unknown',displayed:'Unknown'},
					{'actual': 'XY',displayed:'XY'},
					{'actual': 'XX',displayed:'XX'},
					{'actual': 'XO',displayed:'XO'},
					{'actual': 'XXY',displayed:'XXY'},
					{'actual': 'XYY',displayed:'XYY'},
					{'actual': 'XXX',displayed:'XXX'},
					{'actual': 'XXYY',displayed:'XXYY'},
					{'actual': 'XXXY',displayed:'XXXY'},
					{'actual': 'XXXX',displayed:'XXXX'},
					{'actual': 'Other',displayed:'Other'}
				],
				'type': 'select',
				'tab': 'Personal',
				'function': 'setKaryotypicSex',
				'isMultipleSelect': false
			},
			{
				'name': 'numInGroup',
				'label': 'Number of persons in this group',
				'type': 'select',
				'values': [
					{'actual': 1, displayed: 'N'},
					{'actual': 2, displayed: '2'},
					{'actual': 3, displayed: '3'},
					{'actual': 4, displayed: '4'},
					{'actual': 5, displayed: '5'},
					{'actual': 6, displayed: '6'},
					{'actual': 7, displayed: '7'},
					{'actual': 8, displayed: '8'},
					{'actual': 9, displayed: '9'}
				],
				'tab': 'Personal',
				'function': 'setNumPersons'
			},
			{
				'name': 'external_ids',
				'label': 'External ID(s)',
				'type': 'text',
				'tab': 'Personal',
				'function': 'setExternalID'
			},
			{
				'name': 'ethnicity',
				'label': 'Ethnicities<br>(common to all individuals in the group)',
				'values': [
					{'actual': 'A',displayed:'White: British'},
					{'actual': 'B',displayed:'White: Irish'},
					{'actual': 'C',displayed:'White: Any other White background'},
					{'actual': 'D',displayed:'Mixed: White and Black Caribbean'},
					{'actual': 'E',displayed:'Mixed: White and Black African'},
					{'actual': 'F',displayed:'Mixed: White and Asian'},
					{'actual': 'G',displayed:'Mixed: Any other mixed background'},
					{'actual': 'H',displayed:'Asian or Asian British: Indian'},
					{'actual': 'J',displayed:'Asian or Asian British: Pakistani'},
					{'actual': 'K',displayed:'Asian or Asian British: Bangladeshi'},
					{'actual': 'L',displayed:'Asian or Asian British: Any other Asian background'},
					{'actual': 'M',displayed:'Black or Black British: Caribbean'},
					{'actual': 'N',displayed:'Black or Black British: African'},
					{'actual': 'P',displayed:'Black or Black British: Any other Black background'},
					{'actual': 'R',displayed:'Other Ethnic Groups: Chinese'},
					{'actual': 'S',displayed:'Other Ethnic Groups: Any other ethnic group'},
					{'actual': 'Z',displayed:'Not stated'}
				],
				'type': 'select',
				'tab': 'Personal',
				'function': 'setEthnicities',
				'isMultipleSelect': true
			},
			{
				'label' : "<i class='fa fa-info-circle' aria-hidden='true'></i> Please select coding system for disorder search:",
				'name' : 'disorderType',
				'type' : 'select',
				'tab': 'Clinical',
				'values' : [
					{'actual': 'GEL', displayed: 'GEL Disorders'},
					{'actual': 'OMIM',  displayed: 'OMIM'},
					{'actual': 'ICD10', displayed: 'ICD10'},
					{'actual': 'SnomedCT', displayed: 'SnomedCT'}
				],
				'function' : 'setDisorderType'
			},
			{
				'name': 'disorders',
				'class': 'disordersNodeGroup',
				'label': 'Known disorders<br>(common to all individuals in the group)',
				'type': 'disease-picker',
				'tab': 'Clinical',
				'function': 'setDisorders'
			},
			{
				'name': 'comments',
				'label': 'Comments',
				'type': 'textarea',
				'rows': 4,
				'tab': 'Clinical',
				'function': 'setComments'
			},
			{
				'name': 'adopted',
				'label': 'Adopted status',
				'type': 'radio',
				'tab': 'Personal',
				'columns': 3,
				'values': [
					{ 'actual': '', 'displayed': 'Not adopted' },
					{ 'actual': 'adoptedIn', 'displayed': 'Adopted in' },
					{ 'actual': 'adoptedOut', 'displayed': 'Adopted out' }
				],
				'default': '',
				'tab': 'Personal',
				'function': 'setAdopted'
			},
			{
				'name': 'state',
				'class': 'stateNodeGroup',
				'label': 'All individuals in the group are',
				'type': 'radio',
				'values': [
					{ 'actual': 'alive', 'displayed': 'Alive' },
					{ 'actual': 'aborted', 'displayed': 'Aborted electively' },
					{ 'actual': 'deceased', 'displayed': 'Deceased' },
					{ 'actual': 'miscarriage', 'displayed': 'Miscarried' }
				],
				'default': 'alive',
				'tab': 'Personal',
				'function': 'setLifeStatus'
			},
			{
				'name': 'evaluatedGrp',
				'label': 'Documented evaluation',
				'type': 'checkbox',
				'tab': 'Clinical',
				'function': 'setEvaluated'
			}

		], ["Personal", "Clinical"]);
	},

	/**
	 * @method getNodeGroupMenu
	 * @return {NodeMenu} Context menu for nodes
	 */
	getNodeGroupMenu: function () {
		return this._nodeGroupMenu;
	},

	/**
	 * Creates the context menu for Partnership nodes
	 *
	 * @method generatePartnershipMenu
	 * @return {NodeMenu}
	 */
	generatePartnershipMenu: function () {
		if (this.isReadOnlyMode()) return null;
		var _this = this;
		return new NodeMenu([
			{
				'name': 'consangr',
				'label': 'Consanguinity of this relationship',
				'type': 'radio',
				'values': [
					{ 'actual': 'A', 'displayed': 'Automatic' },
					{ 'actual': 'Y', 'displayed': 'Yes' },
					{ 'actual': 'P', 'displayed': 'Possible' },
					{ 'actual': 'U', 'displayed': 'Unknown' },
					{ 'actual': 'N', 'displayed': 'No' }
				],
				'default': 'A',
				'function': 'setConsanguinity'
			},
			{
				'name': 'broken',
				'label': 'Separated',
				'type': 'checkbox',
				'function': 'setBrokenStatus'
			}
		], [], "relationship-menu");
	},

	/**
	 * @method getPartnershipMenu
	 * @return {NodeMenu} The context menu for Partnership nodes
	 */
	getPartnershipMenu: function () {
		return this._partnershipMenu;
	},

	/**
	 * @method convertGraphCoordToCanvasCoord
	 * @return [x,y] coordinates on the canvas
	 */
	convertGraphCoordToCanvasCoord: function (x, y) {
		var scale = PedigreeEditorParameters.attributes.layoutScale;
		return { x: x * scale.xscale,
			y: y * scale.yscale };
	},

	/**
	 * Starts a timer to save the application state every 30 seconds
	 *
	 * @method initializeSave
	 */
	startAutoSave: function (intervalInSeconds) {
		setInterval(function () {
			editor.getSaveLoadEngine().save()
		}, intervalInSeconds * 1000);
	}
});


var editor;

PedigreeEditor.styles = {
	"blackAndWhite": {
		nodeShapeFemale: {fill: "#ffffff", stroke: "#222222"},
		nodeShapeMale: {fill: "#ffffff", stroke: "#111111"},
		nodeShapeOther: {fill: "#ffffff", stroke: "#222222"},
		nodeShapeDiag: {fill: "#ffffff", stroke: "#222222"},
		nodeShapeAborted: {fill: "#ffffff", stroke: "#222222"}
	}
};

//attributes for graphical elements in the editor
PedigreeEditor.attributes = {
	radius: 40,
	orbRadius: 6,
	touchOrbRadius: 8,
	personHoverBoxRadius: 90,  // 80    for old handles, 90 for new
	newHandles: true,          // false for old handles
	personHandleLength: 75,    // 60    for old handles, 75 for new
	personHandleBreakX: 55,
	personHandleBreakY: 53,
	personSiblingHandleLengthX: 65,
	personSiblingHandleLengthY: 30,
	enableHandleHintImages: true,
	handleStrokeWidth: 5,
	groupNodesScale: 0.85,
	infertileMarkerHeight: 4,
	infertileMarkerWidth: 14,
	twinCommonVerticalLength: 6,
	twinMonozygothicLineShiftY: 24,
	curvedLinesCornerRadius: 25,
	unbornShape: {'font-size': 50, 'font-family': 'Cambria'},
	carrierShape: {fill: '#595959'},
	carrierDotRadius: 8,
	presymptomaticShape: {fill: '#777777', "stroke": "#777777"},
	presymptomaticShapeWidth: 8,
	uncertainShape: {'font-size': '45px', 'font-family': 'Arial', 'fill': '#696969', 'font-weight': 'bold'},
	uncertainSmallShape: {'font-size': '30px', 'font-family': 'Arial', 'fill': '#696969', 'font-weight': 'bold'},
	evaluationShape: {'font-size': 40, 'font-family': 'Arial'},
	nodeShapeFemale: PedigreeEditor.styles.blackAndWhite.nodeShapeFemale,
	nodeShapeMale: PedigreeEditor.styles.blackAndWhite.nodeShapeMale,
	nodeShapeOther: PedigreeEditor.styles.blackAndWhite.nodeShapeOther,
	nodeShapeDiag: PedigreeEditor.styles.blackAndWhite.nodeShapeDiag,
	nodeShapeAborted: PedigreeEditor.styles.blackAndWhite.nodeShapeAborted,
	nodeShapeMenuOn: {fill: "#000", stroke: "none", "fill-opacity": 0.1},
	nodeShapeMenuOff: {fill: "#000", stroke: "none", "fill-opacity": 0},
	nodeShapeMenuOnPartner: {fill: "#000", stroke: "none", "fill-opacity": 0.1},
	nodeShapeMenuOffPartner: {fill: "#000", stroke: "none", "fill-opacity": 0},
	boxOnHover: {fill: "gray", stroke: "none", opacity: 1, "fill-opacity": .35},
	menuBtnIcon: {fill: "#1F1F1F", stroke: "none"},
	deleteBtnIcon: {fill: "#990000", stroke: "none"},
	btnMaskHoverOn: {opacity: .6, stroke: 'none'},
	btnMaskHoverOff: {opacity: 0},
	btnMaskClick: {opacity: 1},
	orbHue: .53,
	phShape: {fill: "white", "fill-opacity": 0, "stroke": 'black', "stroke-dasharray": "- "},
	dragMeLabel: {'font-size': 14, 'font-family': 'Tahoma'},
	pedNumberLabel: {'font-size': 19, 'font-family': 'Serif'},
	descendantGroupLabel: {'font-size': 21, 'font-family': 'Tahoma'},
	label: {'font-size': 20, 'font-family': 'Arial'},
	nameLabels: {'font-size': 20, 'font-family': 'Arial'},
	commentLabel: {'font-size': 19, 'font-family': 'Arial' },
	cancerAgeOfOnsetLabels: {'font-size': 19, 'font-family': 'Arial' },
	externalIDLabels: {'font-size': 18, 'font-family': 'Arial' },
	disorderShapes: {},
	partnershipNode: {fill: '#d79185', stroke: 'black', 'stroke-width': 2},  //#dc7868, #E25740
	partnershipRadius: 7.0,
	partnershipHandleBreakY: 18,
	partnershipHandleLength: 36,
	partnershipLines: {"stroke-width": 1.25, stroke: '#303058'},
	partnershipLinesAdoptedIn: {"stroke-width": 1.25, stroke: '#303058', "stroke-dasharray": "--"},
	consangrPartnershipLines: {"stroke-width": 1.25, stroke: '#402058'},
	noContactLines: {"stroke-width": 1.25, stroke: '#303058', "stroke-dasharray": "-.-."},
	noContactAdoptedIn: {"stroke-width": 1.25, stroke: '#303058', "stroke-dasharray": "-- ."},
	noContactLinesConsangr: {"stroke-width": 1.25, stroke: '#402058', "stroke-dasharray": "-.-."},
	childlessShapeAttr: {"stroke-width": 2.5, stroke: "#3C3C3C"},
	partnershipChildlessShapeAttr: {"stroke-width": 2.0, stroke: "#3C3C3C"},
	childlessLength: 14,
	parnershipChildlessLength: 27,
	graphToCanvasScale: 12,
	layoutRelativePersonWidth: 10,
	layoutRelativeOtherWidth: 2,
	layoutScale: { xscale: 12.0, yscale: 8 },
	maxPrintPreviewPaneHeight: 600,
	minPrintPreviewPaneHeight: 250
};

document.observe("xwiki:dom:loaded", function () {
	editor = new PedigreeEditor();
});