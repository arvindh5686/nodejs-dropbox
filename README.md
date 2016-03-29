## Dropbox

This is a basic Dropbox clone to sync files across multiple remote folders.

Time spent: 12

### Features

#### Required

- [x] Walkthrough Gif embedded in README
- [x] README `Time spent:` includes the number of hours spent on the assignment
- [X] Client can make GET requests to get file or directory contents
- [X] Client can download a directory as an archive
- [X] Client can make HEAD request to get just the GET headers 
- [X] Client can make PUT requests to create new directories and files with content
- [X] Client can make POST requests to update the contents of a file
- [X] Client can make DELETE requests to delete files and folders
- [X] Server will serve from `--dir` or cwd as root
- [X] Server will sync `HTTP` modifications over TCP to the Client
- [X] Server will sync watched file modifications (e.g., `fs.watch`) over TCP to the Client

### Optional

- [ ] Client supports multiple connected clients
- [ ] Client does not need to make additional `GET` request on `"write"` update
- [ ] Client and User will be redirected from HTTP to HTTPS
- [ ] Client will sync back to Server over TCP
- [ ] Client will preserve a 'Conflict' file when pushed changes preceeding local edits
- [ ] Client can stream and scrub video files (e.g., on iOS)
- [ ] Client can create a directory with an archive
- [ ] User can connect to the server using an FTP client


### Walkthrough (nodejs-dropbox-v1.gif)




