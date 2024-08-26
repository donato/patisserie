echo "Executing start.sh"

cd /app/src/
npm install
echo "NPM Finished"
# nodemon -L index.ts
forever -c "nodemon -L --exitcrash" index.ts


# npm --prefix ./src install
# nodemon -L src/index.ts