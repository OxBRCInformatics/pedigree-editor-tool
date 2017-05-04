var config = {
    "version": "v1.2.2",
    "codingDefinitionServiceEndpoint": "/codingDefinitionService",
    // "helpdesk": {
    //     "name": "Help Desk",
    //     "contact": {
    //         "phone": "0000000000",
    //         "email": "help.desk@help.com"
    //     }
    // },
    "diagramEndpoint": {
        //"service": "openclinica",
        //"pathToEditorJSFiles":"/includes/pedigreeEditor/"
        //get path to pedigree directory like :
        //"http://localhost:8083/openclinica/includes/pedigreeEditor/" or
        //"https://gmc.genomicsengland.nhs.uk/rarediseases/demo/includes/pedigreeEditor/"


        "pathToEditorJSFiles": "/",
        "service": "local"

        //"service": "mercury",
        //"mercuryHost": "http://localhost:8080/gel/rare_diseases/pedigrees"
        //"pathToEditorJSFiles":"/includes/pedigreeEditor/"
    },
    "saveAndExit": true
};
