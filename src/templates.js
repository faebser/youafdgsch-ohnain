const testTemplate = ( data ) => {
	return `data is ${ data }`;
};

const ModuleTemplate = ( _object ) => {
	return `
		<h2>${ _object.name } &rarr; ${ _object.made_points } / ${ _object.total_points }</h2>

		<ul>
		${ _object.groups.map( GroupTemplate ).join( '' ) }
		</ul>
	`;
}

const GroupTemplate = ( item ) => {
	console.log( item );
	return `<li> ${ item.name } &rarr; ${ item.made_points } / ${ item.total_points } 
		<table>
		<thead>
		<tr>
			<th>name</th> <th>Number</th> <th>ECTS</th> <th>Semester</th>
		</tr>
		</thead>
		${ item.courses.map( CourseTemplate ).join( '' ) }
		</table>
	</li>`;
}

const CourseTemplate = ( item ) => {
	return `
		<tr>
			<td>${ item.name }</td> <td>${ item.number }</td> <td>${ item.currentEcts }</td>
			<td>${ item.semester }</td>
		</tr>
	`;
}

const PageTemplate = () => {
	return `
			<h1>STUDIENVERLAUF <span>PLUS</span></h1>

			<div>
				<span>Parse Status</span>
				<span id="progress-status">0</span>/
				<span id="progress-max">0</span>
			</div>

			<div id="content"></div>
	`;
};