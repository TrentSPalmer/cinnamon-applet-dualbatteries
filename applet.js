const Applet = imports.ui.applet; // ++
const Settings = imports.ui.settings; // ++ Needed if you use Settings Screen
const PopupMenu = imports.ui.popupMenu; // ++ Needed for menus
const Lang = imports.lang;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop; // Needed for timer update loop
const Util = imports.misc.util;
const Gettext = imports.gettext;
var UUID;

// ++ Always needed
function MyApplet(metadata, orientation, panelHeight, instance_id) {
    this._init(metadata, orientation, panelHeight, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation,panelHeight,instance_id) {
        Applet.TextIconApplet.prototype._init.call(this,orientation,panelHeight,instance_id);


        try {
            this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id); // ++ Picks up UUID from metadata for Settings
            this.appletPath = metadata.path;
            UUID = metadata.uuid;

            this.settings.bind("show-bat0-percent","show_bat0_percent");
            this.settings.bind("show-bat0-capacity","show_bat0_capacity");
            this.settings.bind("show-bat0-estimated-time-remaining","show_bat0_estimated_time_remaining");
            this.settings.bind("show-bat1-percent","show_bat1_percent");
            this.settings.bind("show-bat1-capacity","show_bat1_capacity");
            this.settings.bind("show-bat1-estimated-time-remaining","show_bat1_estimated_time_remaining");

            this.applet_running = true; //** New to allow applet to be fully stopped when removed from panel
            this._main_refresh_loop();   // This starts the MainLoop timer loop
        }
        catch (e) {
            global.logError(e);
        }
    },

    _has_two_batteries: function() {
        let [result, stdout, stderr] = GLib.spawn_command_line_sync('/bin/sh -c "upower -e | grep battery | wc -l"'); 
        if (stdout != null) {
            if (stdout == 2) {
                return true
            }
        }
        return false
    },

    _battery_icon_to_display: function(battery) {
        if (battery == "bat0") {
            let [result, stdout, stderr] = GLib.spawn_command_line_sync('/bin/sh -c "upower -i /org/freedesktop/UPower/devices/battery_BAT0 | awk \'/icon-name/ {print $2}\'"'); 
            return stdout.toString().slice(1,-2)
        } else if (battery == "bat1") {
            let [result, stdout, stderr] = GLib.spawn_command_line_sync('/bin/sh -c "upower -i /org/freedesktop/UPower/devices/battery_BAT1 | awk \'/icon-name/ {print $2}\'"'); 
            return stdout.toString().slice(1,-2)
        }
    },

    _get_battery_capacity: function(battery) {
        if (battery == "bat0") {
            let [result, stdout, stderr] = GLib.spawn_command_line_sync('/bin/sh -c "upower -i /org/freedesktop/UPower/devices/battery_BAT0 | awk \'/energy-full:/ {print $2}\'"'); 
            return stdout.toString().slice(0,-1).replace(/.\d*$/i,'')
        } else if (battery == "bat1") {
            let [result, stdout, stderr] = GLib.spawn_command_line_sync('/bin/sh -c "upower -i /org/freedesktop/UPower/devices/battery_BAT1 | awk \'/energy-full:/ {print $2}\'"'); 
            return stdout.toString().slice(0,-1).replace(/.\d*$/i,'')
        }
    },

    _get_time_to_empty: function(battery) {
        if (battery == "bat0") {
            let [result, stdout, stderr] = GLib.spawn_command_line_sync('/bin/sh -c "upower -i /org/freedesktop/UPower/devices/battery_BAT0 | awk \'/time\ to\ empty/ {print $4}\'"'); 
            return stdout.toString().slice(0,-1)
        } else if (battery == "bat1") {
            let [result, stdout, stderr] = GLib.spawn_command_line_sync('/bin/sh -c "upower -i /org/freedesktop/UPower/devices/battery_BAT1 | awk \'/time\ to\ empty/ {print $4}\'"'); 
            return stdout.toString().slice(0,-1)
        }
    },

    _get_battery_charge_percent: function(battery) {
        if (battery == "bat0") {
            let [result, stdout, stderr] = GLib.spawn_command_line_sync('/bin/sh -c "upower -i /org/freedesktop/UPower/devices/battery_BAT0 | awk \'/percentage/ {gsub(\\\"%\\\",\\\"\\\");print $2}\'"');
            return stdout.toString().slice(0,-1)
        } else if (battery == "bat1") {
            let [result, stdout, stderr] = GLib.spawn_command_line_sync('/bin/sh -c "upower -i /org/freedesktop/UPower/devices/battery_BAT1 | awk \'/percentage/ {gsub(\\\"%\\\",\\\"\\\");print $2}\'"');
            return stdout.toString().slice(0,-1)
        }
    },

    _show_bat0: function() {
        if (this.show_bat0_percent || this.show_bat0_capacity || this.show_bat0_estimated_time_remaining) {
            return "BAT0 - "
        } else { return "" };
    },

    _show_bat0_percent: function(remaining_percent) {
        if (this.show_bat0_percent) {
            return remaining_percent + "% "
        } else { return "" };
    },

    _show_bat0_capacity: function() {
        if (this.show_bat0_capacity) {
            return this._get_battery_capacity("bat0") + "Wh "
        } else { return "" };
    },

    _show_bat0_estimated_time_remaining: function() {
        if (this.show_bat0_estimated_time_remaining) {
            return this._get_time_to_empty("bat0") + "HRS "
        } else { return "" };
    },

    _show_bat1: function() {
        if (this.show_bat1_percent || this.show_bat1_capacity || this.show_bat1_estimated_time_remaining) {
            return "BAT1 - "
        } else { return "" };
    },

    _show_bat1_percent: function(remaining_percent) {
        if (this.show_bat1_percent) {
            return remaining_percent + "% "
        } else { return "" };
    },

    _show_bat1_capacity: function() {
        if (this.show_bat1_capacity) {
            return this._get_battery_capacity("bat1") + "Wh "
        } else { return "" };
    },

    _show_bat1_estimated_time_remaining: function() {
        if (this.show_bat1_estimated_time_remaining) {
            return this._get_time_to_empty("bat1") + "HRS "
        } else { return "" };
    },

    _update_applet: function() {
        if (this._has_two_batteries() === true) {

            this._battery0_charge_percent = this._get_battery_charge_percent("bat0")
            this._battery1_charge_percent = this._get_battery_charge_percent("bat1")

            this._icon_string = ""
            this._icon_string += this._show_bat0();
            this._icon_string += this._show_bat0_percent(this._battery0_charge_percent);
            this._icon_string += this._show_bat0_capacity();
            this._icon_string += this._show_bat0_estimated_time_remaining();

            this._icon_string += this._show_bat1();
            this._icon_string += this._show_bat1_percent(this._battery1_charge_percent);
            this._icon_string += this._show_bat1_capacity();
            this._icon_string += this._show_bat1_estimated_time_remaining();
            this.set_applet_label(this._icon_string)

            if (parseInt(this._battery0_charge_percent) >= parseInt(this._battery1_charge_percent)) {
                this.set_applet_icon_symbolic_name(this._battery_icon_to_display("bat1"));
            } else {
                this.set_applet_icon_symbolic_name(this._battery_icon_to_display("bat0"));
            }

        } else {
            this._battery0_charge_percent = this._get_battery_charge_percent("bat0")
 
            this._icon_string = ""
            this._icon_string += this._show_bat0();
            this._icon_string += this._show_bat0_percent(this._battery0_charge_percent);
            this._icon_string += this._show_bat0_capacity();
            this._icon_string += this._show_bat0_estimated_time_remaining();
            this.set_applet_label(this._icon_string)
            this.set_applet_icon_symbolic_name(this._battery_icon_to_display("bat0"));
        }
    },

    _main_refresh_loop: function() {
        this._update_applet();
        if (this.applet_running === true) {
                Mainloop.timeout_add_seconds(10, Lang.bind(this, this._main_refresh_loop));
            }
    },

    on_applet_removed_from_panel: function() {
        // inhibit the update timer when applet removed from panel
        this.applet_running = false;
        this.settings.finalize();
    }
};


function main(metadata, orientation, panelHeight, instance_id) {
  return new MyApplet(metadata, orientation, panelHeight, instance_id);
}
