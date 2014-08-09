app._registerWidget("youtube", function(scope, elem, $sce) {
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

	if (app._isMuted() || (scope.item.flags && scope.item.flags.indexOf("+mute")>=0))
		playerVars["mute"]=1;

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
				else if (e.data == YT.PlayerState.ENDED && 
					scope.item.flags && 
					scope.item.flags.indexOf("+loop")>=0
				) {
					player.playVideo();
				}
			},

			onReady: function(e) {
				if (playerVars["mute"]) player.mute();

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

				// Handle mute events
				angular.element('#mute').scope().$watch("mute", function(mute) {
					console.log("Got mute evnt");
					if (!scope.item.flags || !scope.item.flags.indexOf("+mute")>=0) {

						console.log("Setting mute to "+mute);
						if (mute)
							player.mute();
						else
							player.unMute();
					}
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
});

