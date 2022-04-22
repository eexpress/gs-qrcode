const { GObject, GLib, Gio, St, Soup } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const ByteArray = imports.byteArray;

const _domain = Me.metadata['gettext-domain'];
const _ = ExtensionUtils.gettext;

function lg(s) { log("===" + _domain + "===>" + s); }

const tmpfile = "/tmp/qrcode.png";

const Indicator = GObject.registerClass(
	class Indicator extends PanelMenu.Button {
		_init() {
			super._init(0.0, _(Me.metadata['name']));
			this._clipboard = St.Clipboard.get_default();
			this.lasttext = '';

			const micon = new St.Icon({ icon_name : "edit-find-symbolic", style_class : 'system-status-icon' });
			this.add_child(micon);
			this.mqrcode = new PopupMenu.PopupBaseMenuItem();
			this.icon = new St.Icon({
				 icon_name : "edit-find-symbolic",
				 icon_size: 256,
				 });
			this.mqrcode.actor.add_child(this.icon);
			this.menu.addMenuItem(this.mqrcode);

			this.menu.connect('open-state-changed', (menu, open) => {
				if (open) {
					this._clipboard.get_text(St.ClipboardType.PRIMARY, (clipboard, text) => {
						if (text && text.length > 4 && text !== this.lasttext) {
							const r = GLib.find_program_in_path("qrcode");
							if (!r) {
								Main.notify(_("需要安装qrcode命令。"));
								return;
							}
							this.lasttext = text;
							GLib.unlink(tmpfile);
							this.async_cmd(text);
						}
					});
				}
			});
		}

		async_cmd(str) {
			try {
				let proc = Gio.Subprocess.new(
					[ 'bash', '-c', `qrcode "${str}" >${tmpfile}` ],
					Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);

				proc.communicate_async(null, null, (proc, res) => {
					try {
						if (proc.get_successful()) {
							this.icon.set_gicon(Gio.Icon.new_for_string(tmpfile));
							//~ this.icon.queue_redraw();
							//~ this.icon.get_content().invalidate(); // is null
							//~ this.menu.actor.queue_redraw();
							//~ this.mqrcode.queue_redraw();
							//~ this.mqrcode.actor().queue_redraw();
							//~ this._canvas.invalidate();
							//~ 不更新显示？??????
							Gio.app_info_launch_default_for_uri(`file://${tmpfile}`, global.create_app_launch_context(0, -1));
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
	}

	disable() {
		this._indicator.destroy();
		this._indicator = null;
	}
}

function init(meta) {
	return new Extension(meta.uuid);
}
