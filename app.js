var app = angular.module('chat', ['firebase']);

app._init = function() {
	app._startTime = (new Date()).getTime();	

	// Hacky way to make the room actually change when hash changes.. TODO FIXME
	$(window).on('hashchange', function() { window.location.reload(); });

	document.title = "linkyloo - " + app._getRoom();

	if (top.location.host != "linkyloo.com" && top.location.host != "localhost")
		top.location.host = "linkyloo.com";

	return app;
}

app._getRoom = function() {
	return window.location.hash.replace(/\W/g,'') || "chat";
}

app._scrollToBottom = function() {
	// New child is fired for every chat line on page load, even if you only set the event
	// up after they were loaded.  This ensures we don't queue up 100 animations on page
	// load.
	if ((new Date()).getTime() - app._startTime > 1000) {
		$('#messages').animate({scrollTop: $('#messages').prop('scrollHeight') }, 100);
	}
	else {
		$('#messages').prop('scrollTop', $('#messages').prop('scrollHeight'));
	}
}

/* Controller for chat */
app.controller('Chat', ['$scope', '$firebase', 
    function($scope, $firebase) {
    	var room = app._getRoom();
	    var ref = new Firebase('https://mushroom-cabal.firebaseio.com/'+room);
	    // TODO FIXME ref.limit doens't seem to work.
	    $scope.messages = $firebase(ref.limit(150));
	    $scope.username = 'Guest' + Math.floor(Math.random()*101);

	    // Adds a message.  If we see a URL we broadcast a URL event so the other
	    // controller can pick it up.
	  	$scope.addMessage = function() {
	      	if ($scope.message) {
	      		if (/(http(?:s)?:\/\/[\w\.\-\/\?:#&=]+)/.test($scope.message)) {
	      			$scope.$root.$broadcast('url', RegExp.$1, $scope.message);
	      		}
		        $scope.messages.$add({
		          from: $scope.username, content: $scope.message
		    	});
	    		$scope.message = "";
	    	}
	    	// Scroll to the bottom on add message
	    	app._scrollToBottom();
	  	};

	  	// Scroll to the bottom on load
	    $scope.messages.$on('loaded', app._scrollToBottom);

	    // Scroll to bottom on new child. 
	    $scope.messages.$on('child_added', app._scrollToBottom);
	}
]);

app._getTypeFromUrl = function(url) {
	if (/\.(?:jpg|gif|png|jpeg|svg)$/i.test(url))
		return "image";
	else if (/(?:youtu\.be|youtube\.com)/.test(url))
		return "youtube";
	else
		return "iframe";
}

// Contoller for the content area
app.controller('Content', ['$scope', '$firebase', '$sce',
	function($scope, $firebase, $sce) {
		var room = app._getRoom();
		var ref = new Firebase('https://mushroom-cabal.firebaseio.com/'+room+'_content');
		$scope.items = $firebase(ref.limit(10));
		$scope.maxZ = 100;

		$scope.addItem = function() {
			$scope.items.$add({
				name: $scope.name,
				type: $scope.type,
				url: $scope.url,
				x: 0,
				y: 0,
				z: 0,
				width: "",
				height: "",
				active: false
			});
		};

		// When we receive a URL event broadcast from the chat controller
		// we call addItem to create a new widget
		$scope.$on('url', function(event, url, message) {
			$scope.name = message.replace(url,"").replace(/[^\w\s]/g, "");
			$scope.type = app._getTypeFromUrl(url);
			$scope.url = url;
			$scope.addItem();
		});

		// When something is removed, remove the coorisponding widget
		$scope.items.$on("child_removed", function(c) {
			$('#'+c.snapshot.name).remove();
		})
	}
]);

/* Widget Definitions */

// This defines the <widget> tag which is created for every piece of content.
app.directive('widget', function($sce) {
	return {
		restrict: 'E',
		replace: true,
		// TODO Move to templateUrl
		template: '<span id="{{id}}" class="ui-widget-content" ' +
			'ng-style="{ top: item.y, left: item.x, width: item.width, ' +
			'height: item.height, \'z-index\': item.z }"></span>',
		link: function(scope, elem, attrs) {
			app._setupWidget(scope, elem, $sce);
			app._setupWidgetEvents(scope, elem);
		}
	};
});

app._setupWidget = function(scope, elem, $sce) {
	scope.$parent.maxZ = Math.max(scope.$parent.maxZ, scope.item.z);

	elem.append('<span class="close">x</span>')
	elem.append('<h3>'+(scope.item.name || scope.item.type)+'</h3>');

	switch (scope.item.type) {
		case "iframe":
			return app._setupWidgetIframe(scope,elem,$sce);
			
		case "image":
			return app._setupWidgetImage(scope,elem,$sce);
			
		case "youtube":
			return app._setupWidgetYoutube(scope,elem,$sce);
			
		default:
			return app._setupWidgetIframe(scope,elem,$sce);
	}
};

app._setupWidgetImage = function(scope, elem, $sce) {
	var url = $sce.trustAsResourceUrl(scope.item.url);

	elem.append('<img src="' + url + '" />');

	if (!scope.item.width && !scope.item.height) {
		elem.children('img').addClass("loading").load(function() { 
			scope.item.width = $(this).width() + "px";
			scope.item.height = ($(this).height() + 25) + "px";
			scope.$parent.items.$save(scope.id);
			$(this).removeClass("loading");
		});	
	}
};

app._setupWidgetIframe = function(scope, elem, $sce) {
	var url = $sce.trustAsResourceUrl(scope.item.url);
	elem.append('<div class="overlay" />');
	elem.append('<iframe src="' + url + 
		'" frameborder="0"></iframe>');
}

app._setupWidgetYoutube = function(scope, elem, $sce) {
	/(?:v=|\/)(\w+)$/.test(scope.item.url);
	var url = $sce.trustAsResourceUrl("//www.youtube.com/embed/"+RegExp.$1);
	elem.append('<div class="overlay" />');
	elem.append('<iframe src="' + url + 
		'" width="560" height="315" frameborder="0"></iframe>');
}

// Add the events to the widget to make it active.
app._setupWidgetEvents = function(scope,elem) {
	elem.children('.close').click(function(e) { 
		e.stopPropagation();
		scope.$parent.items.$remove(scope.id);
	});

	elem.draggable({
			start: function(event, ui) {
			$(this).addClass('dragging').children('.overlay').show();
		},
		
		stop: function(event, ui) {
				$(this).removeClass('dragging').children('.overlay').hide();

  			scope.$apply(function read() {
					scope.item.x = elem.css('left');
					scope.item.y = elem.css('top');
					scope.item.z = elem.css('z-index');
					scope.$parent.items.$save(scope.id);
				})
			}
		})
	.resizable({
  		start: function(event, ui) {
			$(this).addClass('resizing').children('.overlay').show();
		},
		resize: function(event,ui) {
				$(this).children('.overlay').show();
		},
		stop: function(event, ui) {
			$(this).removeClass('resizing').children('.overlay').hide();;

				scope.$apply(function() {
					scope.item.width = elem.css('width');
					scope.item.height = elem.css('height');
  				scope.$parent.items.$save(scope.id);
				})
			}
	})
	.hover(
  		function() { $(this).addClass('hover'); }, 
			function() { $(this).removeClass('hover'); }
	)
	.click(
		function() { 
			scope.item.z = ++scope.$parent.maxZ;
			scope.$parent.items.$save(scope.id);
		}
	);
}

app._init();
