var config = {
	"version": "v1.2.1-SNAPSHOT",
	"codingDefinitionServiceEndpoint": "/codingDefinitionService",
	"diagramEndpoint": {
		//"service": "openclinica",
		//"pathToEditorJSFiles":"/includes/pedigreeEditor/"
		//get path to pedigree directory like :
		//"http://localhost:8083/openclinica/includes/pedigreeEditor/" or
		//"https://gmc.genomicsengland.nhs.uk/rarediseases/demo/includes/pedigreeEditor/"



		//"service": "local",
		"pathToEditorJSFiles":"/",

		"service": "mercury",
		"mercuryHost": "http://localhost:8080/gel/rare_diseases/pedigrees"
		//"pathToEditorJSFiles":"/includes/pedigreeEditor/"
	},
	"saveAndExit": true
};
