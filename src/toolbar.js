document.addEventListener("DOMContentLoaded", () => {
    const editor = document.getElementById("editor");

    document.getElementById("textColorBtn").onclick = () => {
        document.getElementById("textColorPicker").click();
    };

    document.getElementById("bgColorBtn").onclick = () => {
        document.getElementById("bgColorPicker").click();
    };

    document.getElementById("textColorPicker").addEventListener("input", e => {
        document.execCommand("foreColor", false, e.target.value);
    });

    document.getElementById("bgColorPicker").addEventListener("input", e => {
        document.execCommand("hiliteColor", false, e.target.value);
    });

    document.querySelectorAll("#toolbar button[data-command]").forEach(btn => {
        btn.onclick = () => {
            document.execCommand(btn.dataset.command, false, null);
        };
    });
});
