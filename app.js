var app = angular.module('chat', ['firebase']);

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

app._initAuth = function() {
	if (!app._auth) {
		app._user = null;
		app._profile = null;
		app._auth = new FirebaseSimpleLogin(app._ref, function(error, user) {
			if (error) {
   	 			// an error occurred while attempting login
   	 			console.log(error);
				$('#loginError').text(error.message.replace("FirebaseSimpleLogin: ","")).removeClass("hide");
			} 
			else if (user) {
				app._setUser(user);
   	 			console.log("User ID: " + user.uid + ", Provider: " + user.provider);
			} 
		});
	}

	return app._auth;
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
	else
		return "iframe";
}

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
				z: 0,
				width: "",
				height: "",
				active: false
			});
		};

		// When we receive a URL event broadcast from the chat controller
		// we call addItem to create a new widget
		$scope.$on('url', function(event, url, message) {
			$scope.name = message.replace(url,"").replace(/\+\w+\s?/g,"").replace(/[^\w\s]/g, "");
			$scope.flags = message.match(/\+\w+/g);
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

	elem.append('<span class="close">&times;</span>')
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
	var videoId;
	var playerVars = {};

	if (/v=([\w\-]+)/.test(scope.item.url))
		videoId = RegExp.$1;
	else if (/\/([\w\-]+)$/.test(scope.item.url))
		videoId = RegExp.$1;
	else if (/\/([\w\-]+)\?/.test(scope.item.url))
		videoId = RegExp.$1;
	
	if (/list=([\w\-]+)/.test(scope.item.url))
		playerVars["list"] = RegExp.$1;

	console.log("Loading YouTube video="+videoId)
	//var url = $sce.trustAsResourceUrl("//www.youtube.com/embed/"+videoId);

	elem.append('<div class="overlay" />');
	elem.append('<div id="' + scope.id + '_player" />');

	if (scope.flags) {
		scope.flags.forEach(function(flag) {
			if (flag == "+loop") {
				playerVars["loop"]=1;
				playerVars["list"]=(playerVars["list"]||videoId);
			}
			
			if (flag == "+start") playerVars["autoplay"]=1;
		});
	}
console.log(playerVars);
	var player = new YT.Player(scope.id + '_player', {
		width: 560,
		height: 315,
		videoId: videoId,
		playerVars: playerVars,
		events: {
			onStateChange: function(e) {  
				if (e.data == YT.PlayerState.PLAYING) {
					scope.$apply(function() {
						scope.item.active = true;
						scope.$parent.items.$save(scope.id);
					});
				}
				else if (e.data == YT.PlayerState.PAUSED) {
					scope.$apply(function() {
						scope.item.active = false;
						scope.$parent.items.$save(scope.id);
					});
				}
			},

			onReady: function(e) {
				scope.$watch("item.active", function() {
					if (scope.item.active) {
						player.playVideo();
					}
					else {
						player.pauseVideo();
					}
				});

				scope.$watch("item.position", function() {
					player.seekTo(scope.item.position, true);
				});

				if (scope.item.position > 0) {
					player.seekTo(scope.item.position, true);
				}

				if (scope.item.active) {
					player.playVideo();
				}
			}
		}
	});

	var lastTime = 0;
	var timer = window.setInterval(function() { 
		if (player.getCurrentTime) {
			var time = player.getCurrentTime();
			if (Math.abs(time-lastTime) > 5) {
				scope.item.position = time;
				scope.$parent.items.$save(scope.id);
			}
			lastTime = time;
		}
	}, 250);


	elem.on("remove", function() { window.clearInterval(timer); })
	

//	elem.append('<iframe src="' + url + 
//		'" width="560" height="315" frameborder="0"></iframe>');
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

app.signin = function() {
	$('#loginError').addClass('hide');

	if (!$('#password').val()) 
		return $('#loginError').text("You didn't supply a password").removeClass('hide') 

	app._auth.login('password', {
		"email": $('#email').val(),
		"password": $('#password').val()
	});
}

app.signup = function() {
	$('#loginError').addClass('hide');

	if (!$('#password').val()) 
		return $('#loginError').text("You didn't supply a password").removeClass('hide') 

	app._auth.createUser($('#email').val(), $('#password').val(), function(error,user) {
		if (error) {
			console.log(error);
			$('#loginError').text(error.message).removeClass("hide");
		}
		else {
			app.signin();
		}
	})
}

app._getAvatar = function() {
	var u = app._user;
	var tpd = app._user.thirdPartyUserData;

	if (u.provider === "twitter" && tpd.profile_image_url) { 
		return tpd.profile_image_url;
	}
	else if (u.provider === "github" && tpd.avatar_url) {
		return tpd.avatar_url + "?s=48";
	}
	else if (u.provider === "google" && tpd.picture) {
		return tpd.picture.replace(/(.+)\/(.*)/,'$1/s48-c/$2');
	}
	else if (u.provider === "facebook" && tpd.picture && !tpd.picture.data.is_silhouette) {
		return tpd.picture.data.url.replace(/\/s\d+x\d+\//,'/s48x48/');
	}
	else if (u.email) {
		return "http://www.gravatar.com/avatar/" + md5(u.email) + ".png?d=retro&s=48";
	}
	else if (tpd.email) {
		return "http://www.gravatar.com/avatar/" + md5(tpd.email) + ".png?d=retro&s=48";
	}
	else {
		return "http://www.gravatar.com/avatar/" + md5(Math.random()) + ".png?d=retro&s=48";
	}
}

app._setUser = function(user) {
	app._user = user;

   	var $scope = angular.element("#chat").scope();
   	$scope.$apply(function() { $scope.user = user; });
   	$('#loginDialog').modal('hide');

   	app._ref.child("@profiles").child(user.uid).on("value",
   		function(row) {
   			var profile = row.val();

   			if (profile) {
   				profile.avatar = app._getAvatar();
   				
   				app._profile = profile;
   				$scope.$apply(function() { $scope.username = profile.username });

   				var online = app._ref.child("rooms").child(app._getRoom()).child("members").child(user.uid);
   				online.set(profile);
   				online.onDisconnect().remove();
   			}
   			else {
 				$('#changePassword').toggle(app._user.provider === "password");
   				$('#profileDialog').modal('show');
   			}
   		},
   		function(error) {
   			console.log(error);
   		}
   	);
}

app.updateProfile = function() {
	$('#username').val(app._profile.username);
	$('#profileError').addClass("hide");
	$('#changePassword').toggle(app._user.provider === "password");
	$('#profileDialog').modal('show');
}

app.saveProfile = function() {
	$('#profileError').addClass("hide");
	var username = $('#username').val();

	if (!app._profile || username != app._profile.username) {
		app._ref.child("@usernames").child(username).set({
			"uid": app._user.uid
		},
		function(error) {
			if (error) {
				$('#profileError').text("That username is taken").removeClass("hide");
			}
			else {
				if (app._profile)
					app._ref.child("@usernames").child(app._profile.username).remove();

				app._ref.child("@profiles").child(app._user.uid).set({
					"username": username
				},
				function(error) {
					if (error) {
						$('#profileError').text(error).removeClass("hide");
					}
					else {
						var $scope = angular.element("#chat").scope();
						$scope.$apply(function() { $scope.username = username });
						$('#profileDialog').modal('hide');
					}
				});
			}
		});
	}

	var curpass = $('#curpass').val();
	var newpass = $('#newpass').val();
	if (curpass && newpass) {
		app._auth.changePassword(app._user.email, curpass, newpass, function(error, success) {
			if (error) 
				$('#profileError').text(error).removeClass("hide");
			else
				$('#profileDialog').modal('hide');
		});
	}
}

app.signout = function() {
	console.log("Logging out");
	app._ref.child("rooms").child(app._getRoom()).child("members").child(app._user.uid).remove();
	app._auth.logout();
	// TODO FIXME HACK
	window.setTimeout(function() { window.location.reload() }, 250);
}

app._init();
