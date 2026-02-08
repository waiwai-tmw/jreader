use anyhow::Result;
use quick_xml::{
    events::{BytesStart, Event},
    Reader,
};
use serde::Serialize;
use std::{borrow::Cow, os::unix::ffi::OsStrExt};
use std::{
    ffi::OsStr,
    fs::File,
    io::prelude::*,
    path::{Path, PathBuf},
};
use tracing::{instrument, trace, warn};
use zip::ZipArchive;

#[derive(Clone, Default, Debug, Serialize)]
pub struct Image(pub PathBuf);

#[derive(Default, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Book {
    pub title: String,
    pub author: String,
    pub publisher: String,
    pub pub_date: String,
    pub file_path: PathBuf,
    pub cover_zip_path: Option<PathBuf>,
    pub thumbnail: Option<Image>,
}

#[instrument]
pub fn load_book(fname: &Path) -> Result<Book> {
    // TODO: Transform error into `anyhow::Error` and include `fname`
    let zipfile = std::fs::File::open(&fname)?;
    let mut archive = zip::ZipArchive::new(zipfile).unwrap();
    let opf_zip_path = find_location_of_opf_file(&mut archive).unwrap();
    trace!("HI");
    let mut book = load_book_from_opf(&mut archive, opf_zip_path.as_path());
    book.file_path = fname.to_path_buf();
    Ok(book)
}

#[instrument(skip(archive))]
fn find_location_of_opf_file(archive: &mut ZipArchive<File>) -> Option<PathBuf> {
    let mut res = None;
    archive
        .by_name("META-INF/container.xml")
        .map(|mut file| {
            trace!("Found container.xml");

            let mut contents: Vec<u8> = vec![];
            file.read_to_end(&mut contents).unwrap();
            let mut reader = Reader::from_bytes(&contents);
            let mut buf = Vec::new();
            let mut skip_buf: Vec<u8> = Vec::new();

            loop {
                buf.clear();
                if let Ok(Event::Start(ref e)) = reader.read_event(&mut buf) {
                    let s = String::from_utf8_lossy(e.name()).to_string();
                    trace!(name = s, "Event::Start (0)");
                    if b"rootfiles" == e.name() {
                        loop {
                            skip_buf.clear();
                            if let Ok(Event::Empty(ref e)) = reader.read_event(&mut buf) {
                                if b"rootfile" == e.name() {
                                    if has_attribute_with_value_eq_to(
                                        e,
                                        b"media-type",
                                        b"application/oebps-package+xml",
                                    ) {
                                        if let Some(opf_path) = get_attribute_value(e, b"full-path")
                                        {
                                            let opf_path = Path::new(OsStr::from_bytes(&opf_path))
                                                .to_path_buf();
                                            trace!(?opf_path, "Found OPF path");
                                            res = Some(opf_path);
                                            return;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        })
        .ok();

    res
}

#[instrument(level = "trace")]
fn has_attribute_with_value_eq_to(bytes_start: &BytesStart, key: &[u8], value: &[u8]) -> bool {
    get_attribute_value(bytes_start, key)
        .map(|v| v.as_ref().eq(value))
        .unwrap_or(false)
}

#[instrument(level = "trace")]
fn get_attribute_value<'a>(bytes_start: &'a BytesStart, key: &[u8]) -> Option<Cow<'a, [u8]>> {
    bytes_start
        .attributes()
        .find(|a| a.as_ref().unwrap().key == key)
        .map(|a| {
            let a = a.unwrap();
            a.value
        })
}

#[instrument(level = "trace")]
fn mk_path(opf_zip_path: &Path, href: &[u8]) -> PathBuf {
    match opf_zip_path.parent() {
        Some(parent) => Path::new(parent).join(Path::new(OsStr::from_bytes(href))),
        None => Path::new(OsStr::from_bytes(href)).to_path_buf(),
    }
}

#[instrument(skip(archive))]
fn load_book_from_opf(archive: &mut ZipArchive<File>, opf_zip_path: &Path) -> Book {
    trace!(?opf_zip_path, "Loading metadata from OPF");
    let mut book: Book = Default::default();
    let mut cover_zip_path: Option<PathBuf> = None;
    let mut meta_image_id: Option<String> = None;
    let mut first_image_zip_path: Option<PathBuf> = None;
    archive
        .by_name(&opf_zip_path.to_string_lossy())
        .map(|mut file| {
            // println!("Found OPF for {:?}", fname.to_str());

            let mut contents: Vec<u8> = vec![];
            file.read_to_end(&mut contents).unwrap();
            // println!("{:?}", contents);
            let mut reader = Reader::from_bytes(&contents);
            let mut buf = Vec::new();
            let mut skip_buf = Vec::new();

            loop {
                buf.clear();
                match reader.read_event(&mut buf) {
                    Ok(Event::Start(ref e)) => {
                        let s = String::from_utf8_lossy(e.name()).to_string();
                        trace!(name = s, "Event::Start (Outer)");
                        match e.name() {
                            b"metadata" => {
                                trace!("Hit metadata");
                                loop {
                                    skip_buf.clear();
                                    match reader.read_event(&mut skip_buf) {
                                        Ok(Event::Start(ref e)) => {
                                            let s = String::from_utf8_lossy(e.name()).to_string();
                                            trace!(name = s, "Event::Start (Inner)");
                                            match e.name() {
                                                b"dc:title" => {
                                                    let event = reader.read_event(&mut skip_buf);
                                                    trace!(?event, "event inside of `dc:title`");
                                                    match event {
                                                        Ok(Event::Text(ref e)) => {
                                                            book.title = String::from_utf8_lossy(e)
                                                                .to_string();
                                                            trace!(title = book.title, "Hit title");
                                                        }
                                                        _ => (),
                                                    }
                                                }
                                                b"dc:creator" => match reader
                                                    .read_event(&mut skip_buf)
                                                {
                                                    Ok(Event::Text(ref e)) => {
                                                        book.author =
                                                            String::from_utf8_lossy(e).to_string();
                                                    }
                                                    _ => (),
                                                },
                                                b"dc:publisher" => match reader
                                                    .read_event(&mut skip_buf)
                                                {
                                                    Ok(Event::Text(ref e)) => {
                                                        book.publisher =
                                                            String::from_utf8_lossy(e).to_string();
                                                    }
                                                    _ => (),
                                                },
                                                b"dc:date" => {
                                                    match reader.read_event(&mut skip_buf) {
                                                        Ok(Event::Text(ref e)) => {
                                                            book.pub_date =
                                                                String::from_utf8_lossy(e)
                                                                    .to_string();
                                                        }
                                                        _ => (),
                                                    }
                                                }
                                                _ => (),
                                            }
                                        }
                                        Ok(Event::Empty(ref e)) => {
                                            if b"meta" == e.name() {
                                                if has_attribute_with_value_eq_to(
                                                    e, b"name", b"cover",
                                                ) {
                                                    if let Some(s) =
                                                        get_attribute_value(e, b"content")
                                                    {
                                                        let s = String::from_utf8_lossy(&s);
                                                        trace!(?s, "found cover in meta section");
                                                        meta_image_id = Some(s.to_string());
                                                        continue;
                                                    }
                                                }
                                            }
                                        }
                                        Ok(Event::Text(_e)) => (), //txt.push(e.unescape_and_decode(&reader).unwrap())
                                        Ok(Event::End(e)) => {
                                            if e.name() == b"metadata" {
                                                break;
                                            }
                                        }
                                        Ok(Event::Eof) => break, // exits the loop when reaching end of file
                                        Err(e) => panic!(
                                            "Error at position {}: {:?}",
                                            reader.buffer_position(),
                                            e
                                        ),
                                        _ => (), // There are several other `Event`s we do not consider here
                                    }
                                }
                            }
                            b"manifest" => {
                                trace!("Hit manifest");
                                loop {
                                    skip_buf.clear();
                                    match reader.read_event(&mut skip_buf) {
                                        Ok(Event::Empty(ref e)) => match e.name() {
                                            b"item" => {
                                                if first_image_zip_path.is_none()
                                                    && has_attribute_with_value_eq_to(
                                                        e,
                                                        b"media-type",
                                                        b"image/jpeg",
                                                    )
                                                {
                                                    // TODO: Abstract this block out
                                                    if let Some(href) =
                                                        get_attribute_value(e, b"href")
                                                    {
                                                        let path = mk_path(opf_zip_path, &href);
                                                        trace!(?path, "Found first image in OPF");
                                                        first_image_zip_path = Some(path);
                                                    }
                                                }

                                                if has_attribute_with_value_eq_to(
                                                    e,
                                                    b"properties",
                                                    b"cover-image",
                                                ) || has_attribute_with_value_eq_to(
                                                    e, b"id", b"cover",
                                                ) || (meta_image_id.as_ref().map(|x| {
                                                    has_attribute_with_value_eq_to(
                                                        e,
                                                        b"id",
                                                        x.as_bytes(),
                                                    )
                                                }))
                                                .unwrap_or_default()
                                                {
                                                    if let Some(href) =
                                                        get_attribute_value(e, b"href")
                                                    {
                                                        let path = mk_path(opf_zip_path, &href);
                                                        trace!(?path, "Found cover-image");
                                                        cover_zip_path = Some(path);
                                                    }
                                                }
                                            }
                                            _ => {
                                                //println!("1Touched{:?}",  String::from_utf8_lossy(e.name()));
                                            }
                                        },

                                        Ok(Event::Text(_e)) => (), //txt.push(e.unescape_and_decode(&reader).unwrap())
                                        Ok(Event::End(e)) => {
                                            if e.name() == b"manifest" {
                                                break;
                                            }
                                        }
                                        Ok(Event::Eof) => break, // exits the loop when reaching end of file
                                        Err(e) => panic!(
                                            "Error at position {}: {:?}",
                                            reader.buffer_position(),
                                            e
                                        ),
                                        _ => (), // There are several other `Event`s we do not consider here
                                    }
                                }
                            }
                            _ => (), //println!("2Touched{:?}",  String::from_utf8_lossy(e.name())),
                        }
                    }
                    Ok(Event::Text(_e)) => (), //println!("text: {}", String::from_utf8_lossy(&e)),
                    //txt.push(e.unescape_and_decode(&reader).unwrap())
                    Ok(Event::Eof) => break, // exits the loop when reaching end of file
                    Err(e) => panic!("Error at position {}: {:?}", reader.buffer_position(), e),
                    _ => (), // There are several other `Event`s we do not consider here
                };
            }
        })
        .ok(); // TODO Fix this error handling
    if cover_zip_path.is_none() {
        if first_image_zip_path.is_some() {
            warn!(?first_image_zip_path, "Used first image as fallback cover");
            cover_zip_path = first_image_zip_path;
        } else {
            warn!("No cover found, no images to use as fallback");
        }
    }
    book.cover_zip_path = cover_zip_path.clone();

    book
}
