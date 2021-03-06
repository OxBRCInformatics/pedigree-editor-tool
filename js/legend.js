/**
 * Base class for various "legend" widgets
 *
 * @class Legend
 * @constructor
 */

var Legend = Class.create({

	//initiallyHide: is passed for GEL(GenomicsEngland), if true, it means that the menu in legend box should be hidden initially
	initialize: function (title, allowDrop, initiallyHide) {
		//Added for GEL(GenomicsEngland)
		this._initiallyHide = initiallyHide;

		this._affectedNodes = {};     // for each object: the list of affected person nodes

		this._objectColors = {};       // for each object: the corresponding object color

		this._preferredColors = {};    // in the future we'll have the ability to specify color
		// schemes, e.g. "green" for "that and that cancer", even
		// if that particular cancer is not yet present on the pedigree;
		// also used to assign the same disorder colors after save and load
		this._previousHighightedNode = null;

		var legendContainer = $('legend-container');
		if (legendContainer == undefined) {
			if (!editor.isReadOnlyMode()) {
				this._legendInfo = new Element('div', {'class': 'legend-box legend-info', id: 'legend-info'}).insert(
					new Element('div', {'class': 'infomessage'}).insert(
						"You can drag and drop all items from the list(s) below onto individuals in the pedigree to mark them as affected.")
				);
				this.closeButton = new Element('span', {'class': 'close-button'}).update(' ');
				this.closeButton.observe('click', this.hideDragHint.bindAsEventListener(this));
				this._legendInfo.insert({'top': this.closeButton});
				this._legendInfo.hide();
			}
			var legendContainer = new Element('div', {'class': 'legend-container', 'id': 'legend-container'}).insert(this._legendInfo);
			editor.getWorkspace().getWorkArea().insert(legendContainer);
		} else {
			if (!editor.isReadOnlyMode()) {
				this._legendInfo = legendContainer.down('#legend-info');
			}
		}

		this._legendBox = new Element('div', {'class': 'legend-box', id: this._getPrefix() + '-legend-box'});
		this._legendBox.hide();
		legendContainer.insert(this._legendBox);



		var showMoreIcon = new Element('i',{'class':'fa  rightIcon'});
		if(this._initiallyHide === true){
			showMoreIcon.addClassName("fa-angle-double-down");
		}else{
			showMoreIcon.addClassName("fa-angle-double-up");
		}



		//Commented for GEL(GenomicsEngland)
		//These lines are commented and replaced with the following lines
		//var legendTitle = new Element('h2', {'class': 'legend-title'}).update(title);
		//var divTitle = new Element('div', {'class': ''}).update(legendTitle);


		//Added for GEL(GenomicsEngland) to add a show/hide button in the tab title ....................................
		var plusElement = new Element('span', {style:'cursor:pointer;font-size: 90%;'}).insert(title).insert(showMoreIcon);// + '<i class="fa fa-angle-double-down rightIcon"></i>');
		var legendTitle = new Element('h2', {'class': 'legend-title'}).update(plusElement);
		var divTitle = new Element('div', {'class': ''}).update(legendTitle);
		var self = this;
		showMoreIcon.on("click",function(event){
			if(this.hasClassName('fa-angle-double-down')) {
				var nextUL = $$('ul.' + self._getPrefix() + '-list');
				if (nextUL.length > 0) {
					nextUL[0].show();
				}
				this.removeClassName('fa-angle-double-down');
				this.addClassName('fa-angle-double-up');
			}else{
				var nextUL = $$('ul.' + self._getPrefix() + '-list');
				if (nextUL.length > 0) {
					nextUL[0].hide();
				}
				this.addClassName('fa-angle-double-down');
				this.removeClassName('fa-angle-double-up');
			}
		});
		this._legendBox.insert(divTitle);
		//..............................................................................................................



		this._list = new Element('ul', {'class': this._getPrefix() + '-list abnormality-list'});
		this._legendBox.insert(this._list);

		//Added for GEL(GenomicsEngland), to hide the list if initiallyHide is True
		if(this._initiallyHide === true){
			this._list.hide();
		}
		//..............................................................................................................


		Element.observe(this._legendBox, 'mouseover', function () {
			$$('.menu-box').invoke('setOpacity', .1);
		});
		Element.observe(this._legendBox, 'mouseout', function () {
			$$('.menu-box').invoke('setOpacity', 1);
		});

		if (allowDrop) {
			Droppables.add(editor.getWorkspace().canvas, {accept: 'drop-' + this._getPrefix(), onDrop: this._onDropWrapper.bind(this), onHover: this._onHoverWrapper.bind(this)});
		}
	},

	/**
	 * Returns the prefix to be used on elements related to the object
	 * (of type tracked by this legend) with the given id.
	 *
	 * @method _getPrefix
	 * @param {String|Number} id ID of the object
	 * @return {String} some identifier which should be a valid HTML id value (e.g. no spaces)
	 */
	_getPrefix: function (id) {
		// To be overwritten in derived classes
		throw "prefix not defined";
	},

	hideDragHint: function () {
		editor.getPreferencesManager().setConfigurationOption("user", "hideDraggingHint", true);
		this._legendInfo.hide();
	},

	/**
	 * Retrieve the color associated with the given object
	 *
	 * @method getObjectColor
	 * @param {String|Number} id ID of the object
	 * @return {String} CSS color value for the object, displayed on affected nodes in the pedigree and in the legend
	 */
	getObjectColor: function (id) {
		if (!this._objectColors.hasOwnProperty(id))
			return "#ff0000";
		return this._objectColors[id];
	},

	/*
	 * Returns the map id->color of all the currently used colors.
	 */
	getAllColors: function () {
		return this._objectColors;
	},

	/**
	 * Sets all preferred colors at once
	 */
	setAllPreferredColors: function (allColors) {
		for (id in allColors) {
			if (allColors.hasOwnProperty(id)) {
				this.addPreferredColor(id, allColors[id]);
			}
		}
	},

	/**
	 * Set the preferred color for object with the given id. No check is performed to make
	 * sure colors are unique.
	 */
	addPreferredColor: function (id, color) {
		this._preferredColors[id] = color;
	},

	/**
	 * Get the preferred color for object with the given id. If the color is already
	 * there is no guarantee as to what color will be used.
	 */
	getPreferedColor: function (id) {
		if (this._preferredColors.hasOwnProperty(id)) {
			return this._preferredColors[id];
		}
		return null;
	},

	/**
	 * Returns True if there are nodes reported to have the object with the given id
	 *
	 * @method _hasAffectedNodes
	 * @param {String|Number} id ID of the object
	 * @private
	 */
	_hasAffectedNodes: function (id) {
		return this._affectedNodes.hasOwnProperty(id);
	},

	/**
	 * Registers an occurrence of an object type being tracked by this legend.
	 *
	 * @method addCase
	 * @param {String|Number} id ID of the object
	 * @param {String} Name The description of the object to be displayed
	 * @param {Number} nodeID ID of the Person who has this object associated with it
	 */
	//valueAll is passed for GEL(GenomicsEngland)
	addCase: function(id, name, valueAll, nodeID) {
		if (Object.keys(this._affectedNodes).length == 0) {
			this._legendBox.show();
			!editor.getPreferencesManager().getConfigurationOption("hideDraggingHint") &&
			this._legendInfo && this._legendInfo.show();
		}
		if (!this._hasAffectedNodes(id)) {
			this._affectedNodes[id] = [nodeID];
			//valueAll is passed for GEL(GenomicsEngland)
			var listElement = this._generateElement(id, name, valueAll);
			this._list.insert(listElement);
		}
		else {
			this._affectedNodes[id].push(nodeID);
		}
		this._updateCaseNumbersForObject(id);
	},

	/**
	 * Removes an occurrence of an object, if there are any. Removes the object
	 * from the 'Legend' box if this object is not registered in any individual any more.
	 *
	 * @param {String|Number} id ID of the object
	 * @param {Number} nodeID ID of the Person who has/is affected by this object
	 */
	removeCase: function (id, nodeID) {
		if (this._hasAffectedNodes(id)) {
			this._affectedNodes[id] = this._affectedNodes[id].without(nodeID);
			if (this._affectedNodes[id].length == 0) {
				delete this._affectedNodes[id];
				delete this._objectColors[id];

				var htmlElement = this._getListElementForObjectWithID(id)
				htmlElement.remove();
				if (Object.keys(this._affectedNodes).length == 0) {
					this._legendBox.hide();
					if (this._legendBox.up().select('.abnormality').size() == 0) {
						this._legendInfo && this._legendInfo.hide();
					}
				}
			}
			else {
				this._updateCaseNumbersForObject(id);
			}
		}
	},

	/**
	 * Updates internal references to nodes when node ids is/are changed (e.g. after a node deletion)
	 */
	replaceIDs: function (changedIdsSet) {
		for (var abnormality in this._affectedNodes) {
			if (this._affectedNodes.hasOwnProperty(abnormality)) {

				var affectedList = this._affectedNodes[abnormality];

				for (var i = 0; i < affectedList.length; i++) {
					var oldID = affectedList[i];
					var newID = changedIdsSet.hasOwnProperty(oldID) ? changedIdsSet[oldID] : oldID;
					affectedList[i] = newID;
				}
			}
		}
	},

	_getListElementForObjectWithID: function (id) {
		var HTMLid = Helpers.isInt(id) ? id : this._hashID(id);
		return $(this._getPrefix() + '-' + HTMLid);
	},

	/**
	 * Updates the displayed number of nodes assocated with/affected by the object
	 *
	 * @method _updateCaseNumbersForObject
	 * @param {String|Number} id ID of the object
	 * @private
	 */
	_updateCaseNumbersForObject: function (id) {
		var HTMLid = Helpers.isInt(id) ? id : this._hashID(id);
		var label = this._legendBox.down('li#' + this._getPrefix() + '-' + HTMLid + ' .abnormality-cases');
		if (label) {
			var cases = this._affectedNodes.hasOwnProperty(id) ? this._affectedNodes[id].length : 0;
			label.update(cases + "&nbsp;case" + ((cases - 1) && "s" || ""));
		}
	},

	/**
	 * Generate the element that will display information about the given object in the legend
	 *
	 * @method _generateElement
	 * @param {String|Number} id ID of the object
	 * @param {String} name The human-readable object name or description
	 * @return {HTMLLIElement} List element to be insert in the legend
	 */
	//valueAll is passed for GEL(GenomicsEngland)
	_generateElement: function(id, name, valueAll) {
		var color = this.getObjectColor(id);
		var HTMLid = Helpers.isInt(id) ? id : this._hashID(id);
		var item = new Element('li', {'class': 'abnormality ' + 'drop-' + this._getPrefix(), 'id': this._getPrefix() + '-' + HTMLid}).update(new Element('span', {'class': 'disorder-name'}).update(name.escapeHTML()));
		item.store("valueAll",valueAll);
		item.insert(new Element('input', {'type': 'hidden', 'value': id}));
		var bubble = new Element('span', {'class': 'abnormality-color'});
		bubble.style.backgroundColor = color;
		item.insert({'top': bubble});
		var countLabel = new Element('span', {'class': 'abnormality-cases'});
		var countLabelContainer = new Element('span', {'class': 'abnormality-cases-container'}).insert("(").insert(countLabel).insert(")");
		item.insert(" ").insert(countLabelContainer);
		var me = this;
		Element.observe(item, 'mouseover', function () {
			//item.setStyle({'text-decoration':'underline', 'cursor' : 'default'});
			item.down('.disorder-name').setStyle({'background': color, 'cursor': 'default'});
			me._highlightAllByItemID(id, true);
		});
		Element.observe(item, 'mouseout', function () {
			//item.setStyle({'text-decoration':'none'});
			item.down('.disorder-name').setStyle({'background': '', 'cursor': 'default'});
			me._highlightAllByItemID(id, false);
		});
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
	},

	_highlightAllByItemID: function (id, highlight) {
		if (editor.getView().getCurrentDraggable() == null) {
			this._affectedNodes[id] && this._affectedNodes[id].forEach(function (nodeID) {
				var node = editor.getNode(nodeID);
				if (node) {
					if (highlight) {
						node.getGraphics().highlight();
					} else {
						node.getGraphics().unHighlight()
					}
				}
			});
		}
	},

	/**
	 * Callback for dragging an object from the legend onto nodes. Converts canvas coordinates
	 * to nodeID and calls the actual drop holder once the grunt UI work is done.
	 *
	 * @method _onDropWrapper
	 * @param {HTMLElement} [label]
	 * @param {HTMLElement} [target]
	 * @param {Event} [event]
	 * @private
	 */
	_onDropWrapper: function (label, target, event) {
		if (editor.isReadOnlyMode()) {
			return;
		}
		editor.getView().setCurrentDraggable(null);
		//Added for GEL(GenomicsEngland), load valueAll from the label
		var valueAll = label.retrieve("valueAll");
		var id = label.select('input')[0].value;
		this._highlightAllByItemID(id, false); // remove highlight
		this._unhighlightAfterDrag();
		var divPos = editor.getWorkspace().viewportToDiv(event.pointerX(), event.pointerY());
		var pos = editor.getWorkspace().divToCanvas(divPos.x, divPos.y);
		var node = editor.getView().getPersonNodeNear(pos.x, pos.y);
		//console.log("Position x: " + pos.x + " position y: " + pos.y);
		if (node) {
			//Add "node.isRegistered())" into the condition for GEL(GenomicsEngland)
			//This will prevent dropping un-Assigned nodes into a destination node in the UI when participant has GEL participant Id
			if (node.isProband() || node.isRegistered()) {
				// TODO: fix this once family-studies are merged in
				return;
			}
			//Added for GEL(GenomicsEngland), pass valueAll into the drop event (mainly used in drag/drop unRendered nodes)
			//this._onDropObject(node, id);
			this._onDropObject(node, id, valueAll);
		}
	},

	_onFailedDrag: function (node, message, title) {
		editor.getOkCancelDialogue().showCustomized(message, title, "OK", function () {
			node.getGraphics().getHoverBox().animateHideHoverZone();
		});
	},

	/**
	 * Callback for moving around/hovering an object from the legend over nodes. Converts canvas coordinates
	 * to nodeID and calls the actual drop holder once the grunt UI work is done.
	 *
	 * @method _onHoverWrapper
	 * @param {HTMLElement} [label]
	 * @param {HTMLElement} [target]
	 * @param {int} [the percentage of overlapping]
	 * @private
	 */
	_onHoverWrapper: function (label, target, overlap, event) {
		if (editor.isReadOnlyMode()) {
			return;
		}
		editor.getView().setCurrentDraggable(-1); // in drag mode but with no target
		var divPos = editor.getWorkspace().viewportToDiv(event.pointerX(), event.pointerY());
		var pos = editor.getWorkspace().divToCanvas(divPos.x, divPos.y);
		var node = editor.getView().getPersonNodeNear(pos.x, pos.y);
		if (node) {
			//Add "node.isRegistered())" into the condition for GEL(GenomicsEngland)
			//This will prevent displaying the green margin around the destination node when hovering the dragged un-Assigned nodes over a destination node in the UI
			//when participant has GEL participant Id
			if (node.isProband() || node.isRegistered()) {
				// TODO: fix this once family-studies are merged in
				return;
			}
			node.getGraphics().getHoverBox().animateHideHoverZone();
			node.getGraphics().getHoverBox().setHighlighted(true);
			this._previousHighightedNode = node;
		} else {
			this._unhighlightAfterDrag();
		}
	},

	_unhighlightAfterDrag: function () {
		if (this._previousHighightedNode) {
			this._previousHighightedNode.getGraphics().getHoverBox().setHighlighted(false);
			this._previousHighightedNode = null;
		}
	},

	/**
	 * Callback for dragging an object from the legend onto nodes
	 *
	 * @method _onDropGeneric
	 * @param {Person} Person node
	 * @param {String|Number} id ID of the object
	 */
	_onDropObject: function (node, objectID) {
		throw "drop functionality is not defined";
	},

	/*
	 * IDs are used as part of HTML IDs in the Legend box, which breaks when IDs contain some non-alphanumeric symbols.
	 * For that purpose these symbols in IDs are converted in memory (but not in the stored pedigree) to a numeric value.
	 *
	 * @method _hashID
	 * @param {id} ID string to be converted
	 * @return {int} Hashed integer representation of input string
	 */
	_hashID: function (s) {
		s.toLowerCase();
		if (!Array.prototype.reduce) {
			var n = 0;
			for (var i = 0; i < s.length; i++) {
				n += s.charCodeAt(i);
			}
			return "c" + n;
		}
		return "c" + s.split("").reduce(function (a, b) {
			a = ((a << 5) - a) + b.charCodeAt(0);
			return a & a;
		}, 0);
	}
});