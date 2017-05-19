<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
      <title>Pedigree Editor</title>
      <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
      <meta http-equiv="Content-Script-Type" content="text/javascript"/>
      <meta http-equiv="imagetoolbar" content="no"/>
      <link rel="canonical" href="bin/PARTICIPANT_ID"/>
      <meta name="document" content="data.PARTICIPANT_ID"/>
      <meta name="wiki" content="xwiki"/>
      <meta name="space" content="data"/>
      <meta name="page" content="PARTICIPANT_ID"/>
      <meta name="version" content="1.3"/>
      <meta name="restURL" content="wikis/xwiki/spaces/data/pages/PARTICIPANT_ID"/>
      <meta name="form_token" content="wwD9MXlaxCgPfFnxu3vQHQ"/>
      <meta name="gwt:probandDataLoader.jsproperty" content="locale=en"/>
      <meta name="revisit-after" content="7 days"/>
      <meta name="description" content="Pedigree editor"/>
      <meta name="keywords" content="wiki"/>
      <meta name="distribution" content="GLOBAL"/>
      <meta name="rating" content="General"/>
      <meta name="author" content="Unknown User"/>
      <meta http-equiv="reply-to" content=""/>
      <meta name="language" content="en"/>

      <%
      Long time = System.currentTimeMillis();
      Boolean devMode = new Boolean(System.getProperty("devmode"));
      if(devMode){

        // In devmode then load the unminified files
        %>
        <link href="css/style.css" rel="stylesheet" type="text/css" media="all"/>
        <link href="css/print.css" rel="stylesheet" type="text/css" media="print"/>

        <!--[if IE]>
        <link href="css/colibri-ie-all.css" rel="stylesheet" type="text/css" />
        <![endif]-->

        <%
      }else{
        // In prod mode then load minified
        %>
        <link href="css/style.min.css" rel="stylesheet" type="text/css" media="all"/>
        <link href="css/print.min.css" rel="stylesheet" type="text/css" media="print"/>

        <!--[if IE]>
        <link href="css/colibri-ie-all.min.css" rel="stylesheet" type="text/css" />
        <![endif]-->

        <%
      }
      out.println("<link rel=\"stylesheet\" type=\"text/css\" href=\"resources/icons/font-awesome/css/font-awesome.min.css?"+time+"\">");

      String[] jsFiles = {"require", "prototype", "localization", "WebService","xwiki-min"};
      for(String jsFile : jsFiles){
        out.println("<script type=\"text/javascript\" src=\"js/"+jsFile+".js?"+time+"\"></script>");
      }
      String[] jsRestFiles = {"config","version"};
      for(String jsFile : jsRestFiles){
        out.println("<script type=\"text/javascript\" src=\"rest/"+jsFile+".js?"+time+"\"></script>");
      }
      String[] jsDeferFiles = { "effects", "DateTimePicker", "datepicker", "searchSuggest", "lock", "livevalidation_prototype", "fullScreen", "slider", "dragdrop", "raphael", "helpers", "queues", "baseGraph", "xcoordclass", "ordering", "import", "export", "edgeOptimization", "ageCalc", "positionedGraph", "dynamicGraph", "Blob", "FileSaver", "nodeMenu", "nodetypeSelectionBubble", "graphicHelpers", "legend", "disorder", "disorderLegend", "hpoTerm", "hpoLegend", "geneLegend", "unRenderedLegendSuper", "unRenderedLegend", "saveLoadIndicator", "templateSelector", "okCancelDialogue", "importSelector", "exportSelector", "abstractHoverbox", "readonlyHoverbox", "partnershipHoverbox", "personHoverbox", "abstractNode", "abstractNodeVisuals", "abstractPerson", "Settings", "undoRedoManager", "controller", "preferencesManager", "probandDataLoader", "saveLoadEngine", "versionUpdater", "lineSet", "childlessBehavior", "childlessBehaviorVisuals", "partnershipVisuals", "partnership", "abstractPersonVisuals", "personVisuals", "person", "personGroupHoverbox", "personGroupVisuals", "personGroup", "personPlaceholderVisuals", "personPlaceholder", "view", "svgWrapper", "workspace", "cancersLegend", "printEngine", "printDialog", "pedigree", "actionButtons","ContentTopMenu", "PushPatient", "compatibility", "markerScript","pedigreeDate", "pedigreeEditorParameters", "Widgets-new"};
      for(String jsFile : jsDeferFiles){
        out.println("<script type=\"text/javascript\" src=\"js/"+jsFile+".js?"+time+"\" defer=\"defer\"></script>");
      }
      %>

      <script type="text/javascript">
      // <![CDATA[
      define('jQueryNoConflict', ['jquery'], function ($) {
        $.noConflict();
        return $;
      });

      XWiki.webapppath = "";
      XWiki.servletpath = "bin/";
      XWiki.contextPath = "";
      XWiki.mainWiki = "xwiki";
      XWiki.currentWiki = "xwiki";
      XWiki.currentSpace = "data";
      XWiki.currentPage = "PARTICIPANT_ID";
      XWiki.editor = "inline";
      XWiki.viewer = "";
      XWiki.contextaction = "edit";
      XWiki.docisnew = false;
      XWiki.docsyntax = "xwiki/2.1";
      XWiki.docvariant = "";
      XWiki.blacklistedSpaces = ["Import", "Panels", "Scheduler", "Stats", "XAppClasses", "XAppSheets", "XAppTemplates", "XWiki", "WatchCode",
      "WatchSheets", "XApp", "WatchAdmin", "Watch", "ColorThemes", "AnnotationCode"];
      XWiki.hasEdit = true;
      XWiki.hasProgramming = false;
      XWiki.hasBackupPackImportRights = false;
      XWiki.hasRenderer = true;
      window.docviewurl = "/bin/PARTICIPANT_ID";
      window.docediturl = "/bin/edit/data/PARTICIPANT_ID";
      window.docsaveurl = "/bin/save/data/PARTICIPANT_ID";
      window.docgeturl = "/bin/get/data/PARTICIPANT_ID";

      </script>

    </head>
    <body id="body" class="skin-colibri wiki-xwiki space-data viewbody hidelefthideright panel-left-width-Medium panel-right-width-Medium">

    </body>
  </html>
