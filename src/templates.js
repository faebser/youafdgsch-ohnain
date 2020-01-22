const testTemplate = ( data ) => {
	return `data is ${ data }`;
};

const PageTemplate = () => {
	return `
			<h1>STUDIENVERLAUF <span>PLUS</span></h1>

			<div>
				<span>Parse Status</span>
				<span>xx</span>/<span>yy</span>
			</div>

			<h2 class="list-header">
				Module IT
				<span>11 / 13</span>
				+
				<span>1 / 2</span>
				=
				<span>12 / 15</span>
			</h2>

			<ul>
				<li></li>
			</ul>
	`
};