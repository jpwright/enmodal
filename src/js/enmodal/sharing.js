class Sharing {
    constructor() {
    }
    
    update(public_key, private_key) {
        console.log(location.origin);
        $("#share-link-public input").val(location.origin+"/?id="+public_key);
        $("#share-link-private input").val(location.origin+"/?id="+private_key);
    }
}