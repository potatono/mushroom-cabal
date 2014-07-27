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
