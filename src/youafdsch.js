// load frame
// then get inner document and query it

'use strict';

let iframe = document.getElementById('mainfs').children[1];
const domparser = new DOMParser();
const storage = localStorage;
const DEBUG = true;
const _log = console.log;

const ECTS_REGEX = /\d{2}/g;

console.log = function(...input) {
	if(DEBUG) _log(...input);
}

console.log("loading extension");

if (DEBUG) {
	Array.prototype.pluck = function () {
		console.log(this);
		return this;
	};
}

Array.prototype.pluck = function () {
	return this;
};

Array.prototype.uniq = function() {
	try {
		if (this.length === 1 || this.length === 0) return this;
		return this.reduce((acc, [text, item]) => {
			if(acc.length == 0) {
				acc.push([text, item]);
				return acc;
			}
			if(acc[acc.length - 1][0] != text) {
				acc.push([text, item]);
				return acc;
			}
			return acc;

		}, []);
	}
	catch (e) {
		console.error(e);
	}
};

const unzip = ( _array ) => {
	try {
		return _array.reduce( ( acc, item ) => {
			acc[ 0 ].push( item[ 0 ] );
			acc[ 1 ].push( item[ 1 ] );

			return acc;
		}, [ [], [] ]);
	}
	catch ( e ) {
		console.error( e );
		throw e;
	}
}

// check if logged in
// parse list of finished courses
// into id / name / course number / ects points

const studienplanUrl = "https://ufgonline.ufg.ac.at/ufg_online/wbstudienplan.showStudienplan?pOrgNr=&pStpStpNr=1414&pSJNr=1776&pSpracheNr=";
const resultsUrl = "https://ufgonline.ufg.ac.at/ufg_online/pre.init?pstpersonnr=73071";

const parseResults = ( url, progressCallback, progressTotalCallback ) => {
	console.log( `loading ${url}`);

	return new Promise( ( resolve, reject ) => {
		fetch( url )
			.then( ( response ) => {
				response.text()
				.then( (text ) => {
					// parse reponse body into html
					const html = domparser.parseFromString(text, "text/html");
					// query for results in table
					// into array and do some mangling on it
					// parse table items into
					
					// this is going to be the callback fro the progress indicator
					const tempResults = 
						// selects all links inside a table row that start with the correct href
						Array.from( html.querySelectorAll( "tr[class^='z'] a[href*='wbLv.wbShowLVDetail']" ) )
							.reduce( ( acc, a_item ) => {

								acc.objects.push( {
									// get name from target attr of a
									"name": a_item.target,
									// get id from href
									"id": getCourseIdFromHref( a_item.href ),
									// save href
									"href": a_item.href
								} );

								// get course number, ects and module in promise
								acc.promises.push( getNumberAndEctsPoints( a_item.href, progressCallback ) );

								return acc;
							},
							// this is the inital state of the accumulator
							// this will allow us to wait until all
							// promises are resolved.
							// also promises[i] belongs to objects[i] 
							{ "objects": [], "promises": [] } );

					progressTotalCallback( tempResults.promises.length );

					// now we turn the mix of sync an async
					// data into a list of objects that we can actually use
					let results;
					Promise.all( tempResults.promises )
						.then( ( values ) => {
							results =
								values.reduce( ( acc, stuff, index ) => {
									const [ number, ects_modules ] = stuff;

									// we unzip the ects and module array
									const [ modules, ects ] = unzip( ects_modules );

									// and extend the object from the tempResulst
									// with the additional data
									acc.push(
										Object.assign( tempResults.objects[index], { number: number, ects: ects, modules: modules } )
									);

									return acc;
								}, [] );
							resolve( results );
						} );
				} )
			} );

	});

};

const getCourseIdFromHref = ( href ) => {
	return href.split('=')[1];
}

const getNumberAndEctsPoints = ( href, progressCallback ) => {
	return new Promise( ( resolve, reject ) => {
		console.log(`loading ${ href }`);

		// defensive and lazy
		// all errors resolve the promise to an error
		try {
			getHtmlAndParseIntoDom( href )
				.then( ( html ) => {
					// get the course number
					const number = html.querySelector( "form table tr:nth-child(3) td:nth-child(2) table span" ).textContent;
					// and the ects points
					const ectsRows = 
						Array.from( html.querySelectorAll( "form table tr td table tr.coRow.coTableR" ) )
							.filter( ( row ) => {
								// filter out all the rows that are not part of interface cultures study program
								return row.childNodes[1].textContent.indexOf( "Interface Cultures" ) != -1;
							})
							.map( getEctsAndModuleFromRow );

					// call progressCallback
					progressCallback();
					// resolve
					resolve( [number, ectsRows] );
				});
		}
		catch ( e ) {
			console.error( e );
			reject( e );
		}
	});
}

const getEctsAndModuleFromRow = ( rowNode ) => {
	return [
		rowNode.childNodes[3].textContent.trim(),
		parseInt( rowNode.querySelector( 'span.bold' ).textContent )
	]
};

const progress = (state) => {
	return () => {
		state = state + 1;
		console.log(`progress is ${state}`);
	}
};

// https://ufgonline.ufg.ac.at/ufg_online/wborg.display?PORGNR=13942
// https://ufgonline.ufg.ac.at/ufg_online/wbstudienplan.showStudienplan?pOrgNr=13942&pSJNr=1776&pSpracheNr=1&pStpStpNr=1414&pPrintMode=&pIncludeHistoricSJ=TRUE

const MIME_TYPE = 'text/html';

const getHtmlAndParseIntoDom = ( url ) => {
	return new Promise( ( resolve, reject ) => {
		try {
			fetch( url )
				.then( ( response ) => {
					response.text()
						.then( (text) => {
							resolve( domparser.parseFromString( text, MIME_TYPE ) );
						})
				})
		}
		catch ( e ) {
			reject( e );
		};
	});
};


// we get an object that maps from course_id -> module
// and another object that maps from module -> module_props (like sum of ects)
const parseAllCourses = ( url ) => {
	return new Promise( (resolve, reject) => {
		getHtmlAndParseIntoDom( url )
			.then( ( html ) => {
				const rows = Array.from( html.querySelectorAll( 'div > table div > table.list tr' ) );

				let name_pair;

				const [ courses_modules, module_props ] 
					= rows.slice( 1 ) // remove the first row that is only the table headers
					.filter( ( row ) => {
						console.log( row );
						if ( row.hasChildNodes() ) {
							// remove the repetition of modules names with
							// sum of ects
							if ( row.childNodes[ 1 ].classList
									&& row.childNodes[ 1 ].classList.contains( "tblGroup" )
									&& row.childNodes[ 1 ].tagName == "TH"
									&& row.childNodes[ 1 ].getAttribute( "colspan" ) == 4 ) {
								return false;
							}

							// remove sum tables
							if ( row.firstElementChild.classList
								&& row.firstElementChild.classList.contains( 'tblSumGroup' ) ) {
								return false;
							}
						}
						// for all the other rows
						return true;
					})
					.reduce( ( acc, row, index) => {
						// state machine
						// first get module name
						if ( row.hasChildNodes()
							&& row.childNodes[ 1 ].tagName == "TH"
							&& row.childNodes[ 1 ].classList.contains( 'tblGroup' )
							&& !row.childNodes[ 1 ].classList.contains( 'white' )) {
								// we simply add an empty Map for each module
								// and add the groups later
								acc[ 1 ].set( row.childNodes[ 1 ].textContent.trim(), new Map() );
								return acc;
						}
						// add group to modules
						// and update function that returns module-group pair as string
						if ( row.hasChildNodes()
							&& row.childNodes[ 1 ].tagName == "TH"
							&& row.childNodes[ 1 ].classList.contains( 'tblGroup' )
							&& row.childNodes[ 1 ].classList.contains( 'white' )) {
								// get last added module
								const module_name = getLastKeyInMap( acc[ 1 ] );
								const temp = row.childNodes[ 3 ].textContent.trim();
								const group_name = temp.split( " " )[ 0 ]; // get the group name 
								const group_ects = parseInt( temp.match( ECTS_REGEX )[ 1 ] ); // get the second match
								
								name_pair = curriedNamePair( module_name, group_name );

								acc[ 1 ].get( module_name ).set( group_name, group_ects );
								return acc;
						}

						// the actual rows we are interested in
						if ( row.classList.contains( 'z0' ) || row.classList.contains( 'z1' ) ) {
							// set course_id -> name_pair in first map of acc
							acc[0].set( 
								getIdFromHref( row.querySelector( 'a' ).href, 'pstpspnr' ),
							 	name_pair() );

							return acc;
						}

						// debug and error case
						// if we ever reach this we have an error

						console.error( 'uncovered case in state machine ');
						console.error( row );

						// we still return acc as not to stop the reduce
						// or get weird values
						return acc;

					}, [ new Map(), new Map() ]);

					resolve({
						"course_modules": courses_modules,
						"module_probs": module_props
					});
			})
			.catch( ( e ) => {
				console.error( e );
				reject( e );
			});
	});
};

const curriedNamePair = ( module_name, group_name ) => {
	const memory = [ module_name, group_name ];

	return () => memory; // return function that returns memory
}

const getIdFromHref = ( href, target_param ) => {
	// first split off the whole query string
	// and then split by & between parameters
	const params = href.split( '?' )[ 1 ].split( '&' );

	for (var i = 0; i < params.length; i++) {
		const [ param, value ] = params[i].split( '=' );

		if ( param === target_param ) {
			return value;
		}
	}
}

const getLastKeyInMap = map => Array.from( map )[ map.size - 1 ][ 0 ];
const getLastValueInMap = map => Array.from( map )[ map.size - 1 ][ 1 ];


// MAIN ENTRY POINT

const replaceLamePageLwithOurGloriousNewHTML = () => {

	const b = document.createElement( 'body' );
	b.innerHTML = PageTemplate();
	document.body.replaceWith( b );
	document.body.innerHtml = PageTemplate();

	// get correct elements to display progress

	const curryProgressCallback = ( element ) => {
		let state = 0;

		return () => {
			state++;
			element.textContent = state;
		}
	};

	const curryProgressMax = ( element ) => {
		return ( max ) => {
			element.textContent = max;
		}
	}

	const progressCallback = curryProgressCallback( document.querySelector( '#progress-status' ) );
	const progressMax = curryProgressMax( document.querySelector( '#progress-max' ) );

	Promise.all([
		parseAllCourses( 'https://ufgonline.ufg.ac.at/ufg_online/wbstudienplan.showStudienplan?pOrgNr=13942&pSJNr=1776&pSpracheNr=1&pStpStpNr=1414&pPrintMode=&pIncludeHistoricSJ=TRUE' ),
		parseResults( resultsUrl, progressCallback, progressMax )
	])
	.then( ( values ) => {
		console.log( values );
	});
}


iframe.addEventListener('load', function change (event) {
	console.log(event);

	// two cases:
	// 1. we navigate to the visitencard/the student overview
	// 2. we navigate to our "fake" page

	// how do we distinguish those two cases?
	// for 1, the frame has a src attribute but for some
	// fucked up reason it does not change will we move around
	// ufg online. So we cannot resort to just simply check that
	// we need to also check for the existence of a certain node

	console.log( document.querySelector("#mainfs frame[name=detail]").src );

	const frame = document.querySelector( "#mainfs frame[name=detail]" );
	console.log( frame.contentWindow.document.body.querySelector( 'a[href*=studienstatus]' ) );

	// check for the thing we want to exchange
	if ( frame.contentWindow.document.body.querySelector( 'a[href*=studienstatus]' ) != null ) {
		console.log( "found" );
		// change element
		const element = frame.contentWindow.document.body.querySelector( 'a[href*=studienstatus]' );
		console.log(element.onclick);

		// new onclick handler
		element.addEventListener( "click", ( event ) => {
			console.log( "clicked" );
			event.preventDefault();
			replaceLamePageLwithOurGloriousNewHTML();
			// push empty new state into history
			// so that we can get back
			history.pushState("", "title", "ufg-online-sucks-hairy-balls.html");


		});
	}

	console.log( document.body );
	//console.log( domparser.parseFromString( PageTemplate(), MIME_TYPE ) );

	/*try {
		'use strict';

		const innerDoc = iframe.contentDocument || iframe.contentWindow.document;
		const items = Array.from(innerDoc.querySelectorAll('table.list tr'));
		
		if(items.length == 0) return;

		console.log('found a match');

		// removing the huren on click

		Array.from(innerDoc.querySelectorAll('table.list tr a[href*="wbLv.wbShowLVDetail"]'))
			.forEach((element) => {
				console.log(element.getAttribute('onclick'));
				element.removeAttribute('onclick');
				//element.removeAttribute('target');
				element.target = '_blank';
				element.classList.add('link-check');
				element.addEventListener('onclick', () => true);
				const clone = element.cloneNode();
				while (element.firstChild) {
  					clone.appendChild(element.lastChild);
				}
				element.parentNode.replaceChild(clone, element);
				//element.setAttribute('target', '_blank');
			});

		// [[[url, id]...], node], ...]
		const sortedItems = items.reduce((acc, item) => {
			if(item.classList.contains('z0') || item.classList.contains('z1')) {
				const link = Array.from(item.getElementsByTagName('a'))
									.filter((a) => a.classList.contains('link-check'))
									.shift();
				acc[acc.length - 1][0].push([link.href, link.href.split("=")[1]]);
				return acc;
			}
			if(item.classList.length == 0 && (item.textContent == String.fromCharCode(160) || item.firstElementChild.textContent == String.fromCharCode(160))) {
				acc[acc.length - 1][1] = item;
				acc.push([[],]);
				return acc;
			}
			return acc;
		}, [[[]]])
		.filter(item => item[0].length != 0);

		console.log(sortedItems);

		const promises = sortedItems.map((outer) => {
			const [items, node] = outer;
			const _items = items.map(([href, id]) => {
				// try to get result from storage
				const result = storage.getItem(id);
				if(result !== null) {
					return new Promise((resolve) => {
						resolve([parseInt(result), id]);
					});
				}
				return fetch(href)
						.then((response) => {
							return new Promise((resolve) => {
								response.text()
								.then((text) => {
									// parse here
									console.log('id', id);
									const html = domparser.parseFromString(text, "text/html");
									let result = Array.from(html.querySelectorAll('table.cotable .coRow.hi'))
										.map((table_item) => {
											return [table_item.firstElementChild.textContent,  table_item.children[5].textContent];
										})
										.filter(([text, _points]) => {
											return text.indexOf('Interface Cultures') != -1
										})
										.uniq()
										.reduce((sum, [_text, points]) => {
											return sum + parseInt(points);
										}, 0);

									// sum is still 0
									// lets see if it is a freifach

									if (result === 0) {
										try {
											console.log("trying freifach");
											result = Array.from(html.querySelectorAll('td.MaskRenderer'))
													.filter(el => el.textContent.indexOf('Freie Wahllehrveranstaltung') != -1 && el.textContent.indexOf('Freie Wahllehrveranstaltung') == 0)
													.map(el => el.querySelector('span.bold').textContent)
													.reduce((sum, number) => sum + parseInt(number), 0);
											console.log("freifach got", result);
										}
										catch (_) {
											result = 0;
										}
									}

									storage.setItem(id, result);
										
									// resolve to ects points result
									resolve([
										result,
										id
									]);
								});
							});
						});
			});
			return [_items, node];
		});

		console.log(promises[0][0]);

		promises.forEach(([promises, node]) => {
			Promise.all(promises).then(result => {
				node.textContent = result.reduce((sum, [points, _id]) => sum + points, 0)
			})
		});
	}
	catch (e) {
		console.error(e);
	} */
});
