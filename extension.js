const { GObject, GLib, Gio, St, Soup } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const _domain = Me.metadata['gettext-domain'];
const _ = ExtensionUtils.gettext;

function lg(s) { log("===" + _domain + "===>" + s); }

const tmpdir = "/tmp/qrcode/";
const linkdir = "/tmp/qrcode-link/";
const cmd = "qrencode";
const port = '1280';

const Indicator = GObject.registerClass(
	class Indicator extends PanelMenu.Button {
		_init() {
			super._init(0.0, _(Me.metadata['name']));
			this._clipboard = St.Clipboard.get_default();
			this.lasttext = '';
			this.lastfile = '';
			this.ip = this.get_lan_ip();

			const micon = new St.Icon({
				gicon : Gio.icon_new_for_string(Me.path + "/qrcode-symbolic.svg"),
				style_class : 'system-status-icon'
			});
			this.add_child(micon);

			this.mqrcode = new PopupMenu.PopupBaseMenuItem();
			this.mqrcode.set_track_hover = true;
			this.icon = new St.Icon({
				icon_name : "emblem-shared-symbolic",
				icon_size : 256,
			});

			this.mqrcode.actor.add_child(this.icon);
			this.menu.addMenuItem(this.mqrcode);

			this.menu.connect('open-state-changed', (menu, open) => {
				if (open) {
					this._clipboard.get_text(St.ClipboardType.PRIMARY, (clipboard, text) => {
						if (text && text.length > 4 && text !== this.lasttext) {
							const r = GLib.find_program_in_path(cmd);
							if (!r) {
								Main.notify(_(`Need install ${cmd} command.`));
								return;
							}
							this.lasttext = text;
							this.async_cmd(text);
						}
					});
					this._clipboard.get_text(St.ClipboardType.CLIPBOARD, (clipboard, text) => {
						if (!text || text == this.lastfile) { return; }
						this.lastfile = text;
						const filearray = text.split("\n");
						for (let i of filearray) {
							if (GLib.file_test(i, GLib.FileTest.IS_REGULAR)) {
								const t = Gio.File.new_for_path(linkdir + Gio.File.new_for_path(i).get_basename());
								t.make_symbolic_link(i, null);
							}
						}
						if (this.ip) {
							this.async_cmd(`http://${this.ip}:${port}/`);  // ip route
						} else {
							this.icon.icon_name = "webpage-symbolic";
						}
					});
				}
			});
		}

		get_lan_ip() {
			//~ lg(Gio.Socket.get_local_address());
			const ip = Gio.Socket.new(
									 Gio.SocketFamily.IPV4,
									 Gio.SocketType.STREAM,
									 Gio.SocketProtocol.TCP)
						   .get_local_address();
			//~ lg(ip);
			//~ ).get_option(6, 5);
			//~ if ip invalid, clear ip
			//~ return ip;
			return '';
		};

		async_cmd(str) {
			const tmpfile = `${tmpdir}/${Date.now()}`;	// Just P 可变文件名解决  St.Icon 不刷新问题。
			try {
				let proc = Gio.Subprocess.new(
					[ 'bash', '-c', `${cmd} "${str}" -o ${tmpfile}` ],
					Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);

				proc.communicate_async(null, null, (proc, res) => {
					try {
						let [, stdout, stderr] = proc.communicate_finish(res);
						if (proc.get_successful()) {
							this.icon.set_gicon(Gio.icon_new_for_string(tmpfile));
						}
					} catch (e) { logError(e); }
				});
			} catch (e) { logError(e); }
		};

		destroy() {
			super.destroy();
		};
	});

class Extension {
	constructor(uuid) {
		this._uuid = uuid;

		ExtensionUtils.initTranslations();
	}

	enable() {
		this._indicator = new Indicator();
		Main.panel.addToStatusArea(this._uuid, this._indicator);
		GLib.mkdir_with_parents(tmpdir, 0o750);
		GLib.mkdir_with_parents(linkdir, 0o750);
		GLib.chdir(linkdir);
		try {
			this.proc = Gio.Subprocess.new(
				[ 'python3', '-m', 'http.server', port ],
				Gio.SubprocessFlags.NONE);
		} catch (e) { Main.notify(e); }
	}

	disable() {
		this._indicator.destroy();
		this._indicator = null;
		//~ GLib.rmdir(tmpdir);
		lg(GLib.rmdir(tmpdir));	 //-1 ??? need Gio lookup into dir to delete files...
		//~ GLib.rmdir(linkdir);
		lg(GLib.rmdir(linkdir));
		if (this.proc) { this.proc.force_exit(); }
	}
}

function init(meta) {
	return new Extension(meta.uuid);
}
