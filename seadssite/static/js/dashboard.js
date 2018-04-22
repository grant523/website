$(function () {
    var vm = new Vue({
        delimiters: ['${', '}'],
        el: '#vue-div',
        data: {
            'devices': user_devices,
            'selectedRoom': 'ROOM1'
        },
        methods: {
        	// isCorrectRoom takes in the selectedRoom from the managebar, 
        	// and the name of the room we're comparing it to
        	// it returns whether they are equal or not.
        	// this function is necessary due to vue not having an equal operator 
        	isCorrectRoom: function(roomName) {
        		if(this.selectedRoom == roomName) {
        			console.log(""+ this.selectedRoom + "|" + roomName);
        			// to modify the data:
        			// this.selectedRoom = 'ROOM2';
        			return true;
        		} else {
        			return false;
        		}
        	}

        	// setSelectedRoom: function(roomName)


        }
    })
})
