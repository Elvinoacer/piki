git status --short | while IFS= read -r line; do
  status="${line:0:2}"
  file="${line:3}"
  # Strip surrounding quotes if present
  file="${file%\"}"
  file="${file#\"}"
  
  if [[ "$status" == " D" || "$status" == "D " ]]; then
    git rm -- "$file"
    git commit -m "chore: remove $file"
  elif [[ "$status" == " M" || "$status" == "M " ]]; then
    git add -- "$file"
    git commit -m "chore: modify $file"
  else
    git add -- "$file"
    git commit -m "feat: add $file"
  fi
done