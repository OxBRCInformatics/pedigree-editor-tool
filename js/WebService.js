/**
 * Created by soheil on 02/08/2016.
 */

WebService = Class.create({

	initialize: function () {
		this._settings = new Settings();
		this._baseURL = this._settings.getSetting('codingDefinitionServiceEndpoint');
	},

	getOmimLookupPath: function(){
		var endpoint = this._baseURL ? this._baseURL : this._settings.getSetting('codingDefinitionServiceEndpoint');
		return endpoint + "/lookupServices/OMIMLookupService?";
	},

	getIcd10LookupPath: function(){
		var endpoint = this._baseURL ? this._baseURL : this._settings.getSetting('codingDefinitionServiceEndpoint');
		return endpoint + "/lookupServices/ICDLookupService?";
	},

	getSnomedCTLookupPath: function(){
		var endpoint = this._baseURL ? this._baseURL : this._settings.getSetting('codingDefinitionServiceEndpoint');
		return endpoint + "/lookupServices/SNOMEDCTLookupService?";
	},

	getGELLookupPath: function(){
		var endpoint = this._baseURL ? this._baseURL : this._settings.getSetting('codingDefinitionServiceEndpoint');
		return endpoint + "/lookupServices/DiseaseList?";
	},

	getEthnicityLookupPath: function(){
		var endpoint = this._baseURL ? this._baseURL : this._settings.getSetting('codingDefinitionServiceEndpoint');
		return endpoint + "/lookupServices/Ethnicity?";
	},

	getHPOLookupPath: function(){
		var endpoint = this._baseURL ? this._baseURL : this._settings.getSetting('codingDefinitionServiceEndpoint');
		return endpoint + "/OntologyService/LookupService?";
	},

	getDiagramEndpointPath: function(){
		var config = this._settings.getSetting('diagramEndpoint');
		switch(config.service){
			case "mercury":
				var _this = this;
				var accessPath =  _this.getUrlParameter("accessPath", true);
				return accessPath;
				break;
			case "openclinica":
				var eventCRFId = this.getUrlParameter("eventCRFId");
				var status = this.getUrlParameter("status");
				var participantId = this.getUrlParameter("participantId");
				return "/openclinica/pedigree/get?eventCRFId=" + eventCRFId + "&status=" + status + "&participantId=" + participantId;
			case "local":
				return null;
		}
	},

	getPathToEditorFiles: function(){
		var config = this._settings.getSetting('diagramEndpoint');
		switch(config.service){
			case "mercury":
				return "";
				break;
			case "openclinica":
				//get path to pedigree directory like :
				//"http://localhost:8083/openclinica/includes/pedigreeEditor/" or
				//"https://gmc.genomicsengland.nhs.uk/rarediseases/demo/includes/pedigreeEditor/"
				return Helpers.getSiteURL() + "/includes/pedigreeEditor/";
			case "local":
				return Helpers.getSiteURL() + "/";
		}
	},

	saveDiagramEndpointPath: function(){
		var config = this._settings.getSetting('diagramEndpoint');
		switch(config.service){
			case "mercury":
				var _this = this;
				var accessPath    = _this.getUrlParameter("accessPath");
				var participantId = _this.getParticipantIdFromURL();
				return "???";
				break;
			case "openclinica":
				var _this = this;
				var eventCRFId = _this.getUrlParameter("eventCRFId");
				var status = _this.getUrlParameter("status");
				var participantId = _this.getUrlParameter("participantId");
				return "/openclinica/pedigree/update?eventCRFId=" + eventCRFId + "&status=" + status + "&participantId=" + participantId;
			case "local":
				return null;
		}
	},

	getUrlParameter: function getUrlParameter(sParam, doNotDecode) {

		var sPageURL = decodeURIComponent(window.location.search.substring(1));
		if(doNotDecode && doNotDecode == true){
			sPageURL = window.location.search.substring(1);
		}

		var	sURLVariables = sPageURL.split('&')
		var	sParameterName;
		var	i;

		for (i = 0; i < sURLVariables.length; i++) {
			sParameterName = sURLVariables[i].split('=');

			if (sParameterName[0].toLowerCase() === sParam.toLowerCase()) {
				return sParameterName[1] === undefined ? true : sParameterName[1];
			}
		}
	},

	getParticipantId: function(){
		var _this = this;
		var config = this._settings.getSetting('diagramEndpoint');
		switch(config.service){
			case "mercury":
			case "openclinica":
				var participantId = _this.getUrlParameter("participantId");
				return participantId;
				break;
			case "local":
				return null;
		}
	}
});