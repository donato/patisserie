export function addStyling() {
  const style = `
    .scrattch-controlpanel {
      height: 60px;
      width:100%;
      background-color:black;
      color: white;
      padding: 10px;
    }
    .scrattch-controlpanel input {
     border: black 1px solid;
     padding: 4px;
    }
    .scrattch-container {
      position: absolute;
      z-index:100;
      margin: 0 -9px;
    }
    .scrattch-little-box {
    height: 20px;
    width: 32px;
    position: relative;
    text-align: center;
    font-size: 12px;
    font-weight: bold;
    color: black;
    box-sizing: border-box;
    border: 1px solid black;
    line-height: 18px;
    font-family: initial;
    background-color: lightblue;
    }
  `;
  var styleSheet = document.createElement("style")
  styleSheet.textContent = style;
  document.head.appendChild(styleSheet)
}

export function divWithClass(className: string) {
  const div = document.createElement('div');
  div.classList.add(className);
  return div;
}

export function renderLoginButtons(warDiv: HTMLDivElement): Promise<string> {
  const box = divWithClass('scrattch-controlpanel');
  const input = document.createElement('input');
  input.type = 'text';
  input.size = 30;

  const submit = document.createElement('input');
  submit.type = 'button'
  submit.value = 'Submit';

  box.innerHTML = `Please submit your TornStats API Key
    (<a href="https://www.tornstats.com/settings/general">link</a>)`;
  box.appendChild(input);
  box.appendChild(submit);
  warDiv.appendChild(box);

  return new Promise((resolve) => {
    submit.addEventListener('click', () => {
      warDiv.removeChild(box);
      resolve(input.value);
    });
  })
}

export function renderControlButtons(warDiv: HTMLDivElement, clearCacheCallback: () => void) {
  const box = divWithClass('scrattch-controlpanel');

  const submit = document.createElement('input');
  submit.type = 'button'
  submit.value = 'Clear API Key and Cache';

  box.innerText = 'ScrattchCache';
  box.appendChild(submit);
  warDiv.appendChild(box);

  submit.addEventListener('click', () => {
    warDiv.removeChild(box);
    clearCacheCallback();
    Array.from(document.querySelectorAll('.scrattch-container'))
      .forEach(value =>
          value.parentElement.removeChild(value))
    renderLoginButtons(warDiv);
});
}