/*
Copyright (c) 2010, Ajax.org B.V.
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of Ajax.org B.V. nor the
      names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL AJAX.ORG B.V. BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

'use strict';
//
//  FileSession : ファイル管理
//

var FileSession = class {
    constructor() {
        this.fileName = null;
        this.editSession = null;
    }
}

const getMode = function(fileName) {
    return modelist.getModeForPath(fileName).mode;
}

const openFileDialog = function() {
    return new Promise(resolve => {
        const $input = $('<input>', { type: 'file' });
        $input.on('change', e => { resolve(e.target.files[0]); });
        $input.click();
    })
}

const readAsText = function(file) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => { resolve(reader.result); };
        reader.readAsText(file);
    })
}

FileSession.prototype.open = async function(callback) {
    const file = await openFileDialog();
    const content = await readAsText(file);
    this.create(file.name, content);
    if (callback) {
        callback(this);
    }
    return content;
}

FileSession.prototype.save = function() {
    if (window.Blob) {
        $('<a>', {
            href: window.URL.createObjectURL(new Blob([this.editSession.getValue()])),
            download: this.fileName
        })[0].click();
    }
}

FileSession.prototype.rename = function(fileName) {
    this.fileName = fileName;
    this.editSession.setMode(getMode(fileName));
}

FileSession.prototype.create = function(fileName, text) {
    this.fileName = fileName;
    this.editSession = ace.createEditSession(text, getMode(fileName));
    this.editSession.on('changeMode', () => {
        $('.mode').text(this.editSession.getMode().$id);
    })
    return this;
}

FileSession.prototype.set = function(fileName, editSession) {
    this.fileName = fileName;
    this.editSession = editSession;

    return this;
}

FileSession.prototype.setMode = function(mode) {
    this.editSession.setMode(mode);
}

FileSession.prototype.getMode = function() {
    return this.editSession.getMode();
}

const DEFAULT_FILE_NAME = '無題.txt';
let blankNum = 0;
FileSession.prototype.blank = function() {
    if (blankNum) {
        this.fileName = DEFAULT_FILE_NAME.replace('.', ' (' + blankNum + ').');
    } else {
        this.fileName = DEFAULT_FILE_NAME;
    }
    this.create(this.fileName, '');
    blankNum++;

    return this;
}

//
//  セッション管理
//  id:ファイル名
//

var SessionManager = class {
    constructor() {
        const blank = new FileSession().blank();
        this.sessions = new Map([
            [blank.fileName, blank]
        ]);
        this.change(blank.fileName);
    }
}

SessionManager.prototype.change = function(id) {
    editor.setSession(this.sessions.get(id).editSession);
    this.active = id;
    $('.mode').text(this.sessions.get(id).editSession.getMode().$id);
    this.render();
}

SessionManager.prototype.set = function(id, session) {
    this.sessions.set(id, session);
    if (this.active == id) {
        this.change(id);
    }
    sessionManager.render();
    return id;
}

SessionManager.prototype.get = function(id) {
    return this.sessions.get(id);
}

SessionManager.prototype.rename = function(id, name) {
    const val = this.get(id).rename(name);
    this.render();
    return val;
}

SessionManager.prototype.remove = function(id) {
    this.sessions.delete(id);
    if (this.active == id) {
        let key = this.sessions.keys().next().value;
        if (key) {
            this.change(key);
        } else {
            const blank = new FileSession().blank();
            this.set(blank.fileName, blank);
            this.change(blank.fileName);
        }
    }
    sessionManager.render();
}

SessionManager.prototype.getCurrent = function() {
    return this.get(this.active);
}

//タブ描画
SessionManager.prototype.render = function() {
    const $tabContainer = $('#tab_container');

    $tabContainer.empty();

    for (let session of this.sessions) {
        const $tab = $('<li>');
        const $fileName = $('<span>', {
            'class': 'file_name'
        }).text(session[1].fileName);
        $tab.append($fileName);

        if (session[0] == this.active) {
            $tab.addClass('active');

            $fileName.on('dblclick', () => {
                const $input = $('<input>', {
                    'type': 'text',
                    'class': 'file_name',
                    'value': $fileName.text()
                });

                $input.on('keydown', (e) => {
                    if (e.keyCode === 13) {
                        console.log();
                        this.rename(session[0], $input.val());
                    }
                })
                $input.on('blur', () => {
                    this.rename(session[0], $input.val());
                })

                $fileName.replaceWith($input);
                $input.focus();
            });
        } else {
            $tab.on('click', () => {
                this.change(session[0]);
            });
        }
        const $closeButton = $('<span class="close_button"><i class="material-icons">close</i></span>');
        $closeButton.on('click', () => {
            sessionManager.remove(session[0]);
        });

        $tab.append($closeButton);
        $tabContainer.append($tab);
    }
}

//
//  設定等
//

var editor;
var modelist;
var sessionManager;

$(() => {
    editor = ace.edit('editor');
    modelist = ace.require('ace/ext/modelist');
    sessionManager = new SessionManager();

    const StatusBar = ace.require('ace/ext/statusbar').StatusBar;
    console.log();
    var statusBar = new StatusBar(editor, $('footer')[0]);

    //自動補完とスニペット
    editor.setOptions({
        enableBasicAutocompletion: true,
        enableSnippets: true,
        enableLiveAutocompletion: false
    });

    //ショートカット呼び出し
    $(window).on('keydown', event => {
        if (event.ctrlKey) {
            switch (event.key) {
                case 's':
                    console.log('save');
                    sessionManager.getCurrent().save();
                    return false;
                case 'o':
                    console.log('open');
                    new FileSession().open((session) => {
                        sessionManager.change(sessionManager.set(session.fileName, session));
                    });
                    return false;
            }
        }
    });

    //ドラッグ&ドロップ
    $('body').on('drop', (event) => {
        event.preventDefault();
        const files = event.originalEvent.dataTransfer.files;

        for (let file of files) {
            const reader = new FileReader();
            reader.onload = () => {
                sessionManager.set(file.name, new FileSession().create(file.name, reader.result));
            };
            reader.readAsText(file);
        }
    });

    $('body').on('dragover', (event) => {
        event.preventDefault();
        event.originalEvent.dataTransfer.dropEffect = 'copy';
    });

    $(window).on('scroll', () => {
        $('#editor').width(window.innerWidth + window.pageXOffset);
        $('footer').width(window.innerWidth + window.pageXOffset);
    });

    $('#info').on('click', () => {
        const file = new FileSession().create(
            'Readme',
            '*********************************\n' +
            'Web Text Editor ver.1.0β\n' +
            '*********************************\n' +
            'Shortcut:\n' +
            '\tCtrl-S -> save file\n' +
            '\tCtrl-O -> open file\n'
        );
        sessionManager.set(file.fileName, file);
        sessionManager.change(file.fileName);
    });

    $('#open').on('click', () => {
        new FileSession().open((session) => {
            sessionManager.change(sessionManager.set(session.fileName, session));
        });
    });

    $('#save').on('click', () => {
        sessionManager.getCurrent().save();
    });

    $('#undo').on('click', () => {
        sessionManager.getCurrent().editSession.getUndoManager().undo();
    });

    $('#redo').on('click', () => {
        sessionManager.getCurrent().editSession.getUndoManager().redo();
    });

    $('#new').on('click', () => {
        const blank = new FileSession().blank();
        sessionManager.set(blank.fileName, blank);
        sessionManager.change(blank.fileName);
    });

    const changeMode = function() {
        const $input = $('<input>', {
            'type': 'text',
            'class': 'mode',
            'value': $(this).text()
        });

        $input.on('keydown', (e) => {
            if (e.keyCode === 13) {
                $input.replaceWith($(this));
                sessionManager.getCurrent().setMode($input.val());
                $(this).on('click', changeMode);
            }
        })
        $input.on('blur', () => {
            $input.replaceWith($(this));
            sessionManager.getCurrent().setMode($input.val());
            $(this).on('click', changeMode);
        })

        $(this).replaceWith($input);
        $input.focus();
    };

    $('.mode').on('click', changeMode);
})