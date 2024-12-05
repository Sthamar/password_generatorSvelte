<script>
	let passwordLength = 16;
	let includeLowercase = false;
	let includeUppercase = true;
	let includeSymbols = false;
	let includeNumbers = false;
	let password = "";

	const generatePassword = () => {
		const upperCaseChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
		const lowerCaseChars = "abcdefghijklmnopqrstuvwxyz";
		const numberChars = "0123456789";
		const symbolChars = "!@#$%^&*()-_=+[]{}|;:',.<>?/";

		let charPool = "";
		if (includeLowercase) charPool += lowerCaseChars;
		if (includeUppercase) charPool += upperCaseChars;
		if (includeNumbers) charPool += numberChars;
		if (includeSymbols) charPool += symbolChars;

		if(charPool.length === 0){
			password = "Please select at least one option";
			return;
		}
		password = Array.from({length: passwordLength},()=>
		charPool[Math.floor(Math.random()*charPool.length)]
	).join("");
	};
</script>

<style>
	.outputs{
		font-size: 20;
		border:solid;
		margin-top: 15px;
		text-align: center;
	}
</style>

<main class="container">
	<div class="row">
		<h1>Password Generator</h1>
	</div>
	<form on:submit|preventDefault={generatePassword}>
		<div class="row">
			<div class="columns six">
				<label>Password Length</label>
				<input type="range" class="u-full-width" min="8" max="20" bind:value={passwordLength}>
			</div>
			<div class="columns six outputs">
				{passwordLength}
			</div>
		</div>
		<div class="row">
			<label>
				<input type="checkbox" bind:checked={includeUppercase}>
				Include Uppercase Letters
			</label>
		</div>
		<div class="row">
			<label>
				<input type="checkbox" bind:checked={includeLowercase}>
				Include Lowercase Letters
			</label>
		</div>
		<div class="row">
			<label>
				<input type="checkbox" bind:checked={includeNumbers}>
				Include Numbers
			</label>
		</div>
		<div class="row">
			<label>
				<input type="checkbox" bind:checked={includeSymbols}>
				Include Symbols
			</label>
		</div>
		<div class="row">
			<button type="submit">Generate Password</button>
		</div>
	</form>
	<div class="row">
		<div class="columns six">
			<h2>Your Password </h2>
		</div>
		<div class="columns six outputs">{password}</div>
	</div>

</main>