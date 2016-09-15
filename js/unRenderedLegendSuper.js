/**
 * This class is added by Soheil for GEL(GenomicsEngland) 05.09.2016
 * This will help to present UnRendered nodes in a legend
 * This is a copy of hpoLegend.js and then modified and added new methods such as addNode
 * @class Legend
 * @constructor
 */

var unRenderedLegendSuper = Class.create(Legend, {


	/**
	 * Added by Soheil for GEL(GenomicsEngland)
	 * Add a node into unRenderedNode legend
	 *
	 * @param id
	 * @param name
	 * @param nodeID
	 * @param node
	 */
	addNode: function(node) {
		var id = Object.keys(this._affectedNodes).length;
		if (Object.keys(this._affectedNodes).length == 0) {
			this._legendBox.show();
			!editor.getPreferencesManager().getConfigurationOption("hideDraggingHint") &&
			this._legendInfo && this._legendInfo.show();
		}
		if (!this._hasAffectedNodes(id)) {
			this._affectedNodes[id] = [id];
			var listElement = this._generateNode(id, node);
			this._list.insert(listElement);
		}

		this._updateCaseNumbersForObject(id);
	},

	/**
	 * Add the array of nodes in bulk
	 * @param nodes
	 */
	addAllNodes: function(nodes) {
		for(var i = 0; nodes && i < nodes.length;i++){
			this.addNode(nodes[i]);
		}
	},

	/**
	 * Remove all nodes in unRendered legend list
	 */
	removeAllNodes: function () {
		var currentNodesLength = Object.keys(this._affectedNodes).length;
		for(var i = 0; i < currentNodesLength; i++){
			var htmlElement = $(this._getPrefix() + i);
			htmlElement.remove();
		}

		this._legendBox.hide();
		if (this._legendBox.up().select('.abnormality').size() == 0) {
			this._legendInfo && this._legendInfo.hide();
		}

		this._affectedNodes = {};
		this._objectColors  = {};

	},

	/**
	 * Added by Soheil for GEL(GenomicsEngland)
	 *
	 * @param id
	 * @param name
	 * @param nodeID
	 * @param node
	 * @returns {*}
	 * @private
	 */
	_generateNode: function(id, node ) {

		var color = this.getObjectColor(id);
		var HTMLContent = node.participantId + "<br>";

		var item = new Element('li', {'class': 'UnRendered-legend-box-item abnormality ' + 'drop-' + this._getPrefix(), 'id': this._getPrefix() + id}).update(HTMLContent);//new Element('span', {'class': 'disorder-name'}).update("ID"));
		//Add an internal id to the node to find out where in the list it's located
		node.unRenderedIndex = id;
		item.store("valueAll", node);

		item.insert(new Element('span', {class: 'unRenderedItemName'}).update("NHS#: "));
		item.insert(new Element('span', {class: 'unRenderedItemValue'}).update(node.nhsNumber));
		item.insert(new Element('span', {}).update("<br>"));


		if(node.chiNumber && node.chiNumber.length > 0) {
			item.insert(new Element('span', {class: 'unRenderedItemName'}).update("CHI#: "));
			item.insert(new Element('span', {class: 'unRenderedItemValue'}).update(node.chiNumber));
			item.insert(new Element('span', {}).update("<br>"));
		}


		item.insert(new Element('span', {class: 'unRenderedItemName'}).update("Forenames: "));
		item.insert(new Element('span', {class: 'unRenderedItemValue'}).update(node.firstName));
		item.insert(new Element('span', {}).update("<br>"));


		item.insert(new Element('span', {class: 'unRenderedItemName'}).update("Surname: "));
		item.insert(new Element('span', {class: 'unRenderedItemValue'}).update(node.lastName));
		item.insert(new Element('span', {}).update("<br>"));


		item.insert(new Element('span', {class: 'unRenderedItemName'}).update("Gender: "));
		item.insert(new Element('span', {class: 'unRenderedItemValue'}).update(node.sex));
		item.insert(new Element('span', {}).update("<br>"));


		item.insert(new Element('span', {class:'unRenderedItemName'}).update("BirthDate: "));
		var dob = "";
		if(node.birthDate) {
			var dob = node.birthDate.day + "/" + node.birthDate.month + "/" + node.birthDate.year;
		}
		item.insert(new Element('span', {class:'unRenderedItemValue'}).update(dob));
		item.insert(new Element('span', {}).update("<br>"));


		item.insert(new Element('span', {class: 'unRenderedItemName'}).update("Relation: "));
		item.insert(new Element('span', {class: 'unRenderedItemValue'}).update(node.relationshipToProband));
		item.insert(new Element('span', {}).update("<br>"));


		//Hidden elements should has .unRenderedHidden CSS Class ......................................................
		item.insert(new Element('span', {class:'unRenderedItemName unRenderedHidden'}).update("KaryotypicSex: "));
		item.insert(new Element('span', {class:'unRenderedItemValue unRenderedHidden'}).update(node.karyotypicSex));
		item.insert(new Element('span', {class:'unRenderedHidden'}).update("<br>"));

		item.insert(new Element('span', {class:'unRenderedItemName unRenderedHidden'}).update("Disorders:"));
		item.insert(new Element('span', {class:'unRenderedHidden'}).update("<br>"));
		for(var i = 0; i < node.disordersFullDetails.length;i++) {
			item.insert(new Element('span', {class:'unRenderedHidden unRendered-disorder-item'}).update("&bull;&nbsp;" + node.disordersFullDetails[i]._name));
			item.insert(new Element('span', {class:'unRenderedHidden'}).update("<br>"));
		}


		item.insert(new Element('span', {class:'unRenderedItemName unRenderedHidden'}).update("HPO:"));
		item.insert(new Element('span', {class:'unRenderedHidden'}).update("<br>"));
		for(var i = 0; i < node.hpoTermsFullDetails.length;i++) {
			item.insert(new Element('span', {class:'unRenderedHidden unRendered-disorder-item'}).update("&bull;&nbsp;" + node.hpoTermsFullDetails[i]._hpoID + "&nbsp;" + node.hpoTermsFullDetails[i]._name));
			item.insert(new Element('span', {class:'unRenderedHidden'}).update("<br>"));
		}
		//.............................................................................................................


		var moreValuesDots = new Element('span', {class:'moreValueDots'}).update("...&nbsp;");
		var plusElement = new Element('span', {style:'cursor:pointer;font-size: 90%;'}).insert(moreValuesDots).insert('<i class="fa fa-plus-square-o" aria-hidden="true"></i>');
		item.insert(plusElement);


		item.select("span.unRenderedHidden").each(Element.hide);

		plusElement.observe('click', function(event) {
			var plusIcon = this.select("i")[0];
			if(plusIcon.hasClassName('fa-plus-square-o')){
				plusIcon.removeClassName('fa-plus-square-o');
				plusIcon.addClassName('fa-minus-square-o');
				//SHOW THE VALUES
				item.select("span.unRenderedHidden").each(Element.show);
				moreValuesDots.hide();
			}else{
				plusIcon.addClassName('fa-plus-square-o');
				plusIcon.removeClassName('fa-minus-square-o');
				//HIDE THE VALUES
				item.select("span.unRenderedHidden").each(Element.hide);
				moreValuesDots.show();
			}
		});


 		item.insert(new Element('input', {'type': 'hidden', 'value': id}));

		var bubble = new Element('span', {'class': 'UnRendered-abnormality-color'});
		bubble.style.backgroundColor = color;
		item.insert({'top': bubble});

		var countLabelContainer = new Element('span', {'class': 'abnormality-cases-container'});
		item.insert(" ").insert(countLabelContainer);

		new Draggable(item, {
			revert: true,
			reverteffect: function (segment) {
				// Reset the in-line style.
				segment.setStyle({
					height: '',
					left: '',
					position: '',
					top: '',
					zIndex: '',
					width: ''
				});
			},
			ghosting: true
		});

		return item;
	}

});