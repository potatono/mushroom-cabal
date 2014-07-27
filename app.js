var app = angular.module('chat', ['firebase']);

$(window).load(function() { app._init() });

app._init = function() {
	app._startTime = (new Date()).getTime();
	app._ref = new Firebase("https://mushroom-cabal.firebaseio.com");
	app._initAuth();

	// Hacky way to make the room actually change when hash changes.. TODO FIXME
	$(window).on('hashchange', function() { window.location.reload(); });

	document.title = "linkyloo - " + app._getRoom();

	if (top.location.host != "linkyloo.com" && top.location.host != "localhost")
		top.location.href = "http://linkyloo.com/";


	// Show message to reload if version updates.
	app._ref.child("@version").on("value", function(snap) {
		console.log("Version="+snap.val());
		if (!app._version) {
			app._version = snap.val();
		}
		else if (app._version != snap.val()) {
			
			$('#reload').removeClass("hide");
		}
	});

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
app.controller('Chat', ['$scope', '$firebase', '$firebaseSimpleLogin',
    function($scope, $firebase, $firebaseSimpleLogin) {
    	var room = app._getRoom();
    	var ref = new Firebase('https://mushroom-cabal.firebaseio.com/rooms/'+room+'/chat');
	    // TODO FIXME ref.limit doens't seem to work.
	    $scope.messages = $firebase(ref.limit(150));
	    $scope.user = app._user;
	    $scope.username = ('Guest' + Math.floor(Math.random()*101))

	    // Adds a message.  If we see a URL we broadcast a URL event so the other
	    // controller can pick it up.
	  	$scope.addMessage = function() {
	      	if ($scope.message) {
	      		if (/(http(?:s)?:\/\/[\w\.\-\/\?:#&=]+)/.test($scope.message)) {
	      			$scope.$root.$broadcast('url', RegExp.$1, $scope.message);
	      		}

		        $scope.messages.$add({
		        	"uid": app._user.uid,
					"from": $scope.username,  
					"content": $scope.message,
					"avatar": (app._profile && app._profile.avatar)
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

app.controller('Presence', ['$scope', '$firebase', 
	function($scope, $firebase) {
		var room = app._getRoom();
		var ref = new Firebase('https://mushroom-cabal.firebaseio.com/rooms/'+room+'/members');

		$scope.users = $firebase(ref);
	}
]);

app._getTypeFromUrl = function(url) {
	if (/\.(?:jpg|gif|png|jpeg|svg)$/i.test(url))
		return "image";
	else if (/(?:youtu\.be|youtube\.com)/.test(url))
		return "youtube";
	else if (/soundcloud\.com/.test(url))
		return "soundcloud";
	else
		return "iframe";
}

app._initSizesByType = {
	"image": 		{ "width":"", 		"height":"" },
	"youtube": 		{ "width":"560px",	"height":"315px" },
	"soundcloud": 	{ "width":"640px",	"height":"450px" },
	"iframe": 		{ "width":"800px",	"height":"600px" }
};

// Contoller for the content area
app.controller('Content', ['$scope', '$firebase', '$sce',
	function($scope, $firebase, $sce) {
		var room = app._getRoom();
		var ref = new Firebase('https://mushroom-cabal.firebaseio.com/rooms/'+room+'/content');
		$scope.items = $firebase(ref.limit(10));
		$scope.maxZ = 100;

		$scope.addItem = function() {
			$scope.items.$add({
				name: $scope.name,
				type: $scope.type,
				url: $scope.url,
				x: 0,
				y: 0,
				z: ($scope.maxZ+1),
				width: app._initSizesByType[$scope.type].width,
				height: app._initSizesByType[$scope.type].height,
				flags: $scope.flags,
				active: ($scope.flags.indexOf("+start")>=0)
			});
		};

		// When we receive a URL event broadcast from the chat controller
		// we call addItem to create a new widget
		$scope.$on('url', function(event, url, message) {
			$scope.name = message.replace(url,"").replace(/\+\w+\s?/g,"").replace(/[^\w\s]/g, "");
			$scope.flags = message.match(/\+\w+/g) || [];
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
