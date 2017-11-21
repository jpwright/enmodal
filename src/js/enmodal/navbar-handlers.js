$(function() {
    $("#register-submit").click(function(e) {
        $.ajax({ url: "register",
            async: true,
            method: "POST",
            data: $("#ajax-register-form").serialize(),
            dataType: 'json',
            success: function(data, status) {
                console.log("register");
                if (data.result == "OK") {
                    $(".form-group").removeClass("has-error");
                    $("#register-submit").hide();
                    $("#dropdown-register-problem").fadeOut();
                    $("#dropdown-register-done").fadeIn();
                } else {
                    $(".form-group").removeClass("has-error");
                    for (var i = 0; i < data.fields.length; i++) {
                        $("#"+data.fields[i]).addClass("has-error");
                    }
                    $("#dropdown-register-problem").text(data.message);
                    $("#dropdown-register-problem").fadeIn();
                }
            }
        });
    });
    
    $("#login-submit").click(function(e) {
        $.ajax({ url: "login",
            async: true,
            method: "POST",
            data: $("#ajax-login-form").serialize(),
            dataType: 'json',
            success: function(data, status) {
                console.log("login");
                if (data.result == "OK") {
                    $("#logged-in-user-email").text(data.email);
                    $("#nav-user-logged-in").show();
                    $("#nav-user-logged-out").hide();
                    if (UNAUTH_PAGE_ACCESS) {
                        location.reload();
                    }
                } else {
                    $("#login-reset-password").hide();
                    $("#login-resend-validation").hide();
                    $("#login-problem").hide();
                    if (data.message == "pending registration") {
                        $("#login-resend-validation").fadeIn();
                    } else {
                        $("#login-problem").fadeIn();
                    }
                }
            }
        });
    });
    
    $(".forgot-password").click(function(e) {
        $.ajax({ url: "reset-password",
            async: true,
            method: "POST",
            data: $("#ajax-login-form").serialize(),
            dataType: 'json',
            success: function(data, status) {
                console.log("login");
                if (data.result == "OK") {
                    $("#login-resend-validation").hide();
                    $("#login-problem").hide();
                    $("#login-reset-password").fadeIn();
                } else {
                    $("#login-resend-validation").hide();
                    $("#login-problem").text(data.message);
                    $("#login-problem").fadeIn();
                }
            }
        });
    });
    
    $("#login-resend-validation-button").click(function(e) {
        $.ajax({ url: "resend-registration",
            async: true,
            method: "POST",
            data: $("#ajax-login-form").serialize(),
            dataType: 'json',
            success: function(data, status) {
                //console.log("resend-registration");
                if (data.result == "OK") {
                    $("#login-resend-validation").text("A new confirmation will be sent to you shortly.");
                }
            }
        });
    });
        
    $("#logout").click(function(e) {
        $.ajax({ url: "logout",
            async: true,
            dataType: 'json',
            success: function(data, status) {
                console.log("logout");
                location.reload();
            }
        });
    });
});