$(function() {
    $.ajax({ url: "user-maps",
        async: true,
        dataType: 'json',
        success: function(data, status) {
            console.log(data);
            $("#user-maps").html("");
            for (var i = 0; i < data.maps.length; i++) {
                var map = data.maps[i];
                var cache_string = (Math.random()+1).toString(36).slice(2, 5);
                $("#user-maps").append('<a href="'+map.url+'" target="_blank"><div class="user-map"><img src="static/img/map-screenshots/'+map.id+'.png?d='+cache_string+'" onerror="if (this.src != \'static/img/map.png\') this.src = \'static/img/map.png\';" /><div class="map-title">'+map.title+'</div><div class="map-actions"><a class="button" data-toggle="modal" data-target="#map-delete-confirm"><i class="fa fa-trash-o" aria-hidden="true"></i> Delete</a></div></div></a>');
            }
        }
    });
    
    $("#change-password-submit").click(function(e) {
        $.ajax({ url: "change-password",
            async: true,
            method: "POST",
            data: $("#ajax-change-password-form").serialize(),
            dataType: 'json',
            success: function(data, status) {
                console.log("register");
                if (data.result == "OK") {
                    $(".form-group").removeClass("has-error");
                    $("#change-password-submit").hide();
                    $("#change-password-problem").fadeOut();
                    $("#change-password-done").fadeIn();
                } else {
                    $(".form-group").removeClass("has-error");
                    for (var i = 0; i < data.fields.length; i++) {
                        $("#"+data.fields[i]).addClass("has-error");
                    }
                    $("#change-password-problem").text(data.message);
                    $("#change-password-problem").fadeIn();
                }
            }
        });
    });
});