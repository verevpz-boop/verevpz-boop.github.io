' Silent launcher for pavel-site Next.js dev server — no console window
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "D:\pavel-site"
WshShell.Run "cmd /c npm run dev", 0, False
