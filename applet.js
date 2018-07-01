const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Applet = imports.ui.applet; // ++
const Settings = imports.ui.settings; // ++ Needed if you use Settings Screen
const Lang = imports.lang;
const Mainloop = imports.mainloop; // Needed for timer update loop
var UUID;

// generate the following information with the following command
// dbus-send --system --print-reply --dest=org.freedesktop.UPower /org/freedesktop/UPower org.freedesktop.DBus.Introspectable.Introspect
const UPowerIface = '<node>\
    <interface name="org.freedesktop.UPower">\
        <method name="EnumerateDevices"> \
            <arg name="devices" direction="out" type="ao"/> \
        </method> \
    </interface> \
</node>';
const UPowerProxy = Gio.DBusProxy.makeProxyWrapper(UPowerIface);

// generate the following information with the following command
// dbus-send --system --print-reply --dest=org.freedesktop.UPower /org/freedesktop/UPower/devices/DisplayDevice org.freedesktop.DBus.Introspectable.Introspect
// or if you prefer
// dbus-send --system --print-reply --dest=org.freedesktop.UPower /org/freedesktop/UPower/devices/battery_BAT0 org.freedesktop.DBus.Introspectable.Introspect
const UPowerDevIface = '<node>\
    <interface name="org.freedesktop.UPower.Device">\
        <method name="GetStatistics"> \
            <arg name="data" direction="out" type="a(dd)"/> \
        </method> \
        <property type="s" name="NativePath" access="read"/> \
        <property type="s" name="Vendor" access="read"/> \
        <property type="s" name="Model" access="read"/> \
        <property type="s" name="Serial" access="read"/> \
        <property type="t" name="UpdateTime" access="read"/> \
        <property type="u" name="Type" access="read"/> \
        <property type="b" name="PowerSupply" access="read"/> \
        <property type="b" name="HasHistory" access="read"/> \
        <property type="b" name="HasStatistics" access="read"/> \
        <property type="b" name="Online" access="read"/> \
        <property type="d" name="Energy" access="read"/> \
        <property type="d" name="EnergyEmpty" access="read"/> \
        <property type="d" name="EnergyFull" access="read"/> \
        <property type="d" name="EnergyFullDesign" access="read"/> \
        <property type="d" name="EnergyRate" access="read"/> \
        <property type="d" name="Voltage" access="read"/> \
        <property type="d" name="Luminosity" access="read"/> \
        <property type="x" name="TimeToEmpty" access="read"/> \
        <property type="x" name="TimeToFull" access="read"/> \
        <property type="d" name="Percentage" access="read"/> \
        <property type="d" name="Temperature" access="read"/> \
        <property type="b" name="IsPresent" access="read"/> \
        <property type="u" name="State" access="read"/> \
        <property type="b" name="IsRechargeable" access="read"/> \
        <property type="d" name="Capacity" access="read"/> \
        <property type="u" name="Technology" access="read"/> \
        <property type="u" name="WarningLevel" access="read"/> \
        <property type="u" name="BatteryLevel" access="read"/> \
        <property type="s" name="IconName" access="read"/> \
    </interface> \
</node>';
const UPowerDevProxy = Gio.DBusProxy.makeProxyWrapper(UPowerDevIface);


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

            this.settings.bind("show-bat0-rate","show_bat0_rate");
            this.settings.bind("show-bat0-percent","show_bat0_percent");
            this.settings.bind("show-bat0-capacity","show_bat0_capacity");
            this.settings.bind("show-bat0-estimated-time-remaining","show_bat0_estimated_time_remaining");
            
            this.settings.bind("show-bat1-rate","show_bat1_rate");
            this.settings.bind("show-bat1-percent","show_bat1_percent");
            this.settings.bind("show-bat1-capacity","show_bat1_capacity");
            this.settings.bind("show-bat1-estimated-time-remaining","show_bat1_estimated_time_remaining");

            this.settings.bind("show-display-battery-rate","show_display_battery_rate");
            this.settings.bind("show-display-battery-percent","show_display_battery_percent");
            this.settings.bind("show-display-battery-capacity","show_display_battery_capacity");
            this.settings.bind("show-display-battery-estimated-time-remaining","show_display_battery_estimated_time_remaining");

            this.applet_running = true; //** New to allow applet to be fully stopped when removed from panel
            this._main_refresh_loop();   // This starts the MainLoop timer loop
        }
        catch (e) {
            global.logError(e);
        }
    },

    _update_applet: function() {
        if (this._has_two_batteries() === true) {
            let UPBat0Proxy = new UPowerDevProxy(Gio.DBus.system,"org.freedesktop.UPower","/org/freedesktop/UPower/devices/battery_BAT0");
            let UPBat1Proxy = new UPowerDevProxy(Gio.DBus.system,"org.freedesktop.UPower","/org/freedesktop/UPower/devices/battery_BAT1");
            let UPDspDevProxy = new UPowerDevProxy(Gio.DBus.system,"org.freedesktop.UPower","/org/freedesktop/UPower/devices/DisplayDevice");

            this._icon_string = ""

            if (this.show_bat0_rate || this.show_bat0_percent || this.show_bat0_capacity || this.show_bat0_estimated_time_remaining) {
                this._icon_string += "BAT0 - "
                if (this.show_bat0_rate) {
                    this._icon_string += Math.round(UPBat0Proxy.EnergyRate*10)/10 + "W/H,"
                }
                if (this.show_bat0_percent) {
                    this._icon_string += UPBat0Proxy.Percentage + "%,"
                }
                if (this.show_bat0_capacity) {
                    this._icon_string += Math.floor(UPBat0Proxy.EnergyFull)  + "Wh,"
                }
                if (this.show_bat0_estimated_time_remaining) {
                    let _bat0_estimated_time_remaining = UPBat0Proxy.TimeToEmpty
                    this._icon_string += Math.floor(_bat0_estimated_time_remaining/3600)  + ":" + Math.floor((_bat0_estimated_time_remaining%3600)/60/10) + Math.floor((_bat0_estimated_time_remaining%3600)/60%10) +  "Hrs  "
                }
            }

            if (this.show_bat1_rate || this.show_bat1_percent || this.show_bat1_capacity || this.show_bat1_estimated_time_remaining) {
                this._icon_string += "BAT1 - "
                if (this.show_bat1_rate) {
                    this._icon_string += Math.round(UPBat1Proxy.EnergyRate*10)/10 + "W/H,"
                }
                if (this.show_bat1_percent) {
                    this._icon_string += UPBat1Proxy.Percentage + "%,"
                }
                if (this.show_bat1_capacity) {
                    this._icon_string += Math.floor(UPBat1Proxy.EnergyFull)  + "Wh,"
                }
                if (this.show_bat1_estimated_time_remaining) {
                    let _bat1_estimated_time_remaining = UPBat1Proxy.TimeToEmpty
                    this._icon_string += Math.floor(_bat1_estimated_time_remaining/3600)  + ":" + Math.floor((_bat1_estimated_time_remaining%3600)/60/10) + Math.floor((_bat1_estimated_time_remaining%3600)/60%10) +  "Hrs  "
                }
            }

            if (this.show_display_battery_rate || this.show_display_battery_percent || this.show_display_battery_capacity || this.show_display_battery_estimated_time_remaining) {
                this._icon_string += "COMB - "
                if (this.show_display_battery_rate) {
                    this._icon_string += Math.round(UPDspDevProxy.EnergyRate*10)/10 + "W/H,"
                }
                if (this.show_display_battery_percent) {
                    this._icon_string += Math.floor(UPDspDevProxy.Percentage) + "%,"
                }
                if (this.show_display_battery_capacity) {
                    this._icon_string += Math.floor(UPDspDevProxy.EnergyFull)  + "Wh,"
                }
                if (this.show_display_battery_estimated_time_remaining) {
                    let _display_battery_estimated_time_remaining = UPDspDevProxy.TimeToEmpty
                    this._icon_string += Math.floor(_display_battery_estimated_time_remaining/3600)  + ":" + Math.floor((_display_battery_estimated_time_remaining%3600)/60/10) + Math.floor((_display_battery_estimated_time_remaining%3600)/60%10) +  "Hrs "
                }
            }

            this.set_applet_label(this._icon_string)
            this.set_applet_icon_symbolic_name(UPDspDevProxy.IconName);

        } else {
            let UPBat0Proxy = new UPowerDevProxy(Gio.DBus.system,"org.freedesktop.UPower","/org/freedesktop/UPower/devices/battery_BAT0");
 
            this._icon_string = ""

            if (this.show_bat0_rate || this.show_bat0_percent || this.show_bat0_capacity || this.show_bat0_estimated_time_remaining) {
                this._icon_string += "BAT0 - "
                if (this.show_bat0_rate) {
                    this._icon_string += Math.round(UPBat0Proxy.EnergyRate*10)/10 + "W/H,"
                }
                if (this.show_bat0_percent) {
                    this._icon_string += UPBat0Proxy.Percentage + "%,"
                }
                if (this.show_bat0_capacity) {
                    this._icon_string += Math.floor(UPBat0Proxy.EnergyFull)  + "Wh,"
                }
                if (this.show_bat0_estimated_time_remaining) {
                    let _bat0_estimated_time_remaining = UPBat0Proxy.TimeToEmpty
                    this._icon_string += Math.floor(_bat0_estimated_time_remaining/3600)  + ":" + Math.floor((_bat0_estimated_time_remaining%3600)/60/10) + Math.floor((_bat0_estimated_time_remaining%3600)/60%10) +  "Hrs  "
                }
            }

            this.set_applet_label(this._icon_string)
            this.set_applet_icon_symbolic_name(UPBat0Proxy.IconName);
        }
    },

    _has_two_batteries: function() {
        let UPProxy = new UPowerProxy(Gio.DBus.system,"org.freedesktop.UPower","/org/freedesktop/UPower");
        let _UPowerProxy_devices = UPProxy.EnumerateDevicesSync()[0];
        let _UPowerProxy_devices_length = _UPowerProxy_devices.length;
        
        for (var i=0; i<_UPowerProxy_devices_length; i++) {
            if (_UPowerProxy_devices[i] === '/org/freedesktop/UPower/devices/battery_BAT1') {
                return true
            };
        }
        return false
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
